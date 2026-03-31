import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

// Cấu hình Gemini API
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const schema: Schema = {
  type: SchemaType.ARRAY,
  description: "Danh sách kết quả phân tích cho từng bài viết",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: "ID của bài viết được phân tích" },
      isDrl: { type: SchemaType.BOOLEAN, description: "True nếu bài viết nói về hoạt động/sự kiện có cộng điểm rèn luyện cho sinh viên, Cần tuyển CTV, tình nguyện viên, người tham dự." },
      organizer: { type: SchemaType.STRING, description: "Đơn vị tổ chức (Ban, Khoa, Hội, CLB). Trả về Chuỗi rỗng nếu không rõ." },
      activityType: { type: SchemaType.STRING, description: "Loại hình hoạt động (Workshop, Talkshow, Tình nguyện, Cuộc thi, Điểm danh, v.v.). Trả về Chuỗi rỗng nếu không rõ." },
      eventTime: { type: SchemaType.STRING, description: "Thời gian diễn ra sự kiện. Trả về Chuỗi rỗng nếu không rõ." },
      fee: { type: SchemaType.STRING, description: "Chi phí tham gia (VD: 0đ, Miễn phí, 50.000 VNĐ). Trả về Chuỗi rỗng nếu không rõ." },
      registrationProcess: { type: SchemaType.STRING, description: "Quy trình đăng ký tóm gọn nhất (như link đăng ký, cú pháp...). Trả về Chuỗi rỗng nếu không rõ." }
    },
    required: ["id", "isDrl"]
  }
};
const model = genAI ? genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: schema,
  }
}) : null;

// Bản đồ Tên hiển thị -> ID (hoặc Handle) trang Facebook
const PAGES: Record<string, string> = {
  "Ngoại Ngữ": "SFL.KhoaNgoaiNguUEH",
  "Toán - Thống Kê": "doanhoi.ttk",
  "Luật": "doanhoikhoaluatueh",
  "BIT": "htttkdueh",
  "Kinh Tế": "doanhoikhoakinhte",
  "Kế Toán": "doanhoiketoan",
  "Kinh Doanh Quốc Tế - Marketing": "kqmueh",
  "Chính Trị - Xã Hội": "LlctUeh",
  "KTX": "KTX4345NCTUEH",
  "Công Nghệ Kinh Tế": "ETClub.UEH",
  "Quản Trị": "ueh.doanhoiquantri",
  "Quản Lý Nhà Nước": "SOG.UEH",
  "English Zone": "UEH.EZ",
  "Ngân Hàng": "doanhoikhoanganhang.ueh",
  "Du Lịch": "doanhoi.sot.ueh",
  "UEH Youth": "youthueh"
};

export interface AIData {
  isDrl: boolean;
  organizer: string;
  activityType: string;
  eventTime: string;
  fee: string;
  registrationProcess: string;
}

export interface Post {
  id: string;
  url: string;
  text: string;
  time: string;
  scrapedAt: string;
  aiData?: AIData | null;
}

interface DataStore {
  lastUpdated: string;
  pages: Record<string, Post[]>;
}

const dataFile = path.resolve(process.cwd(), 'public', 'data.json');

async function analyzePostsBulkWithGemini(posts: {id: string, text: string}[]) {
  if (!model || posts.length === 0) return [];
  
  // Lọc bớt bài viết để tránh gọi API lãng phí
  const keywords = ['tham gia', 'đăng ký', 'mssv', 'điểm rèn luyện', 'đrl', 'điểm số', 'tình nguyện', 'workshop', 'talkshow', 'cuộc thi', 'chương trình', 'thời gian'];
  const validPosts = posts.filter(p => keywords.some(kw => p.text.toLowerCase().includes(kw)));
  
  // Dựng mảng kết quả mặc định
  const results: any[] = posts.map(p => ({
    id: p.id, isDrl: false, organizer: "", activityType: "", eventTime: "", fee: "", registrationProcess: ""
  }));

  if (validPosts.length === 0) return results;

  const prompt = `Phân tích danh sách các bài đăng sự kiện sinh viên sau đây (cắt ngắn đoạn đầu).
Trả về JSON cấu trúc Array. Mỗi item map đúng ID của bài viết được cung cấp.

Bài viết:
${JSON.stringify(validPosts.map(p => ({id: p.id, text: p.text.substring(0, 1000)})), null, 2)}`;
  
  try {
    const aiRes = await model.generateContent(prompt);
    const parsed = JSON.parse(aiRes.response.text().trim());
    
    // Merge ai res
    for (const r of parsed) {
      const idx = results.findIndex(x => x.id === r.id);
      if (idx !== -1) results[idx] = r;
    }
  } catch (e) {
    console.error("Lỗi khi gọi Gemini AI bulk:", e);
  }
  return results;
}

async function scrapePage(pageId: string, pageName: string, browserContext: any): Promise<Post[]> {
  console.log(`Bắt đầu cào dữ liệu từ page: ${pageName} (${pageId})...`);
  const page = await browserContext.newPage();
  const posts: Post[] = [];

  try {
    const url = `https://www.facebook.com/${pageId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const postElements = await page.$$('div[role="article"][aria-posinset]');
    console.log(`Tìm thấy ${postElements.length} bài viết trên bảng tin ${pageName}`);

    let postUrls: string[] = [];
    // Tìm 3 bài viết mới nhất
    for (const el of postElements) {
      const linkEls = await el.$$('a[href*="/posts/"], a[href*="/videos/"], a[href*="/photos/"]');
      if (linkEls.length > 0) {
        let pUrl = await linkEls[0].getAttribute('href') || '';
        if (pUrl.startsWith('/')) {
          pUrl = 'https://www.facebook.com' + pUrl.split('?')[0];
        } else {
          pUrl = pUrl.split('?')[0];
        }
        
        // Loại bỏ comment rác (nếu nhầm URL)
        if (pUrl && !postUrls.includes(pUrl) && (pUrl.includes('/posts/') || pUrl.includes('/videos/') || pUrl.includes('/photos/'))) {
          postUrls.push(pUrl);
        }
        if (postUrls.length >= 3) break;
      }
    }

    if (postUrls.length === 0) {
      console.log(`Không tìm thấy link bài viết nào trên trang ${pageName}.`);
      return posts;
    }

    for (const [index, postUrl] of postUrls.entries()) {
      console.log(`[${index + 1}/${postUrls.length}] Truy cập bài viết: ${postUrl}`);
      const p = await browserContext.newPage();
      try {
        await p.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await p.waitForTimeout(4000);

        let id = `post_${pageName}_${Date.now()}`;
        const match = /fbid=([0-9]+)/.exec(postUrl) || /\/posts\/([a-zA-Z0-9]+)/.exec(postUrl) || /\/videos\/([0-9]+)/.exec(postUrl);
        if (match) id = match[1];

        let textContent = '';
        const messageBlocks = await p.$$('div[data-ad-comet-preview="message"]');
        if (messageBlocks.length > 0) {
          textContent = await messageBlocks[0].innerText();
        } else {
          const fallbacks = await p.$$('div[role="main"] div[dir="auto"]');
          for (const fb of fallbacks) {
            const t = await fb.innerText();
            if (t.length > 50) { textContent = t; break; }
          }
        }

        if (!textContent) {
          const articles = await p.$$('div[role="article"]');
          if (articles.length > 0) textContent = await articles[0].innerText();
        }

        // Bỏ qua nếu nội dung dưới 50 ký tự (khả năng siêu cao là Comment hoặc rác)
        if (textContent.length < 50) textContent = '';

        if (textContent.trim() && !textContent.includes("This content isn't available right now")) {
          posts.push({
            id,
            text: textContent.replace(/\n\n+/g, '\n').trim(),
            url: postUrl,
            time: new Date().toISOString(),
            scrapedAt: new Date().toISOString()
          });
          console.log(`Đã cào thành công bài viết ID: ${id}`);
        } else {
          console.log(`Bài viết rỗng hoặc bị chặn.`);
        }
      } catch (err) {
        console.error(`Lỗi cào bài viết cụ thể ${postUrl}:`, err);
      } finally {
        await p.close();
      }
    }

  } catch (error) {
    console.error(`Lỗi khi cào dữ liệu trang ${pageName}:`, error);
  } finally {
    await page.close();
  }

  return posts;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });

  // Load existing data to preserve history
  let existingData: DataStore = { lastUpdated: new Date().toISOString(), pages: {} };
  if (fs.existsSync(dataFile)) {
    try {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      existingData = JSON.parse(raw);
    } catch (e) {
      console.error("Lỗi đọc file data cũ, tiến hành tiếp với data rỗng.");
    }
  }

  const allPosts: Record<string, Post[]> = existingData.pages || {};
  const pendingAIPosts: {id: string, text: string, postRef: Post}[] = [];

  // 1. Cào hết Data lưu vào Memory
  for (const [displayName, pageId] of Object.entries(PAGES)) {
    const newPosts = await scrapePage(pageId, displayName, context);
    
    if (!allPosts[displayName]) allPosts[displayName] = [];
    const mergedPosts = [...allPosts[displayName]];

    for (const np of newPosts) {
      let existingPost = mergedPosts.find(p => p.id === np.id || p.text.substring(0, 50) === np.text.substring(0, 50));
      if (!existingPost) {
        mergedPosts.push(np);
        pendingAIPosts.push({ id: np.id, text: np.text, postRef: np });
      } else if (!existingPost.aiData) {
        // Bài viết đã cào nhưng chưa gọi AI hoặc AI từng lỗi
        pendingAIPosts.push({ id: existingPost.id, text: existingPost.text, postRef: existingPost });
      }
    }

    // Sort để đưa bài mới lên trên, giữ lại tối đa 40 bài mỗi fanpage cho nhẹ data
    mergedPosts.sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    allPosts[displayName] = mergedPosts.slice(0, 40);
  }

  // 2. Feed tất cả bài cần phân tích cho AI 1 lần (Bulk Request)
  if (pendingAIPosts.length > 0) {
    console.log(`\nCó ${pendingAIPosts.length} bài viết cần AI phân tích. Đang gọi Gemini bulk...`);
    const inputForAI = pendingAIPosts.map(p => ({ id: p.id, text: p.text.substring(0, 1000) })); // cắt ngắn text bớt để đỡ tốn token
    const aiResults = await analyzePostsBulkWithGemini(inputForAI);
    
    // Gắn ngược lại aiData cho từng bài viết
    for (const res of aiResults) {
      const match = pendingAIPosts.find(p => p.id === res.id);
      if (match) {
        match.postRef.aiData = {
          isDrl: res.isDrl || false,
          organizer: res.organizer || '',
          activityType: res.activityType || '',
          eventTime: res.eventTime || '',
          fee: res.fee || '',
          registrationProcess: res.registrationProcess || ''
        };
      }
    }
    console.log(`Đã phân tích xong ${aiResults.length} kết quả từ AI.`);
  } else {
    console.log("\nKhông có bài viết mới nào cần AI phân tích.");
  }

  await browser.close();

  const finalData: DataStore = {
    lastUpdated: new Date().toISOString(),
    pages: allPosts
  };

  fs.writeFileSync(dataFile, JSON.stringify(finalData, null, 2));
  console.log('Đã cập nhật dữ liệu thành công.');
}

main().catch(console.error);
