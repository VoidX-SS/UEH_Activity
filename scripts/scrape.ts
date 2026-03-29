import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

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

interface Post {
  id: string;
  url: string;
  text: string;
  time: string;
  scrapedAt: string;
}

interface DataStore {
  lastUpdated: string;
  pages: Record<string, Post[]>;
}

const dataFile = path.resolve(process.cwd(), 'public', 'data.json');

async function scrapePage(pageId: string, pageName: string, browserContext: any): Promise<Post[]> {
  console.log(`Bắt đầu cào dữ liệu từ page: ${pageName} (${pageId})...`);
  const page = await browserContext.newPage();
  const posts: Post[] = [];

  try {
    // Bước 1: Vào trang chủ Fanpage để quét Link bài viết mới nhất
    const url = `https://www.facebook.com/${pageId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // Chờ JS render trang
    
    // Tìm các bài đăng hiển thị
    const postElements = await page.$$('div[role="article"]');
    console.log(`Tìm thấy ${postElements.length} bài viết trên ${pageName}`);

    let postUrl = '';
    // Lặp để tìm bài viết đầu tiên có link hợp lệ
    for (const el of postElements) {
        const linkEls = await el.$$('a[href*="/posts/"], a[href*="/videos/"], a[href*="/photos/"]');
        if (linkEls.length > 0) {
            postUrl = await linkEls[0].getAttribute('href') || '';
            if (postUrl.startsWith('/')) {
                postUrl = 'https://www.facebook.com' + postUrl.split('?')[0];
            } else {
                postUrl = postUrl.split('?')[0]; // Cắt bớt query rác
            }
            if (postUrl) break; // Chỉ cần bài đầu tiên
        }
    }

    if (!postUrl) {
      console.log(`Không tìm thấy link bài viết nào trên trang ${pageName}.`);
      return posts;
    }

    console.log(`Đã tìm thấy link bài mới nhất: ${postUrl}. Đang truy cập để lấy full text...`);

    // Bước 2: Truy cập thẳng vào link bài viết cụ thể
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // Đợi render xong bài viết

    // Tạo ID tạm thời
    let id = `post_${pageName}_${Date.now()}`;
    const match = /fbid=([0-9]+)/.exec(postUrl) || /\/posts\/([a-zA-Z0-9]+)/.exec(postUrl) || /\/videos\/([0-9]+)/.exec(postUrl);
    if (match) id = match[1];

    // Lấy nội dung text
    // Trên trang bài viết chi tiết, data-ad-comet-preview="message" thường là nơi chứa full text
    // Hoặc lấy article đầu tiên (là post gốc, không lấy comment)
    let textContent = '';
    const messageBlocks = await page.$$('div[data-ad-comet-preview="message"]');
    if (messageBlocks.length > 0) {
      textContent = await messageBlocks[0].innerText();
    } else {
      // Fallback: lấy từ thẻ div chứa dir="auto" với phong cách văn bản
      const fallbacks = await page.$$('div[role="main"] div[dir="auto"]');
      for (const fb of fallbacks) {
        const t = await fb.innerText();
        if (t.length > 50) {
          textContent = t;
          break;
        }
      }
    }

    // Nếu vẫn không có, lấy entire article đầu tiên làm fallback cuối
    if (!textContent) {
       const articles = await page.$$('div[role="article"]');
       if (articles.length > 0) textContent = await articles[0].innerText();
    }

    if (textContent.trim() && !textContent.includes("This content isn't available right now")) {
        posts.push({
            id,
            text: textContent.replace(/\n\n+/g, '\n').trim(), // Lấy FULL text, không cắt 500 ký tự nữa
            url: postUrl,
            time: new Date().toISOString(),
            scrapedAt: new Date().toISOString()
        });
        console.log(`Đã cào thành công bài viết ID: ${id}`);
    } else {
        console.log(`Bài viết rỗng hoặc bị chặn trên ${pageName}.`);
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

  const allPosts: Record<string, Post[]> = {};

  for (const [displayName, pageId] of Object.entries(PAGES)) {
    const newPosts = await scrapePage(pageId, displayName, context);
    
    // Ghi đè bằng dữ liệu mới nhất, KHÔNG lưu data cũ
    allPosts[displayName] = newPosts;
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
