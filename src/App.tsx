import { useEffect, useState } from 'react';

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
  pageName?: string;
}

interface DataStore {
  lastUpdated: string;
  pages: Record<string, Post[]>;
}

function App() {
  const [data, setData] = useState<DataStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Mặc định hiển thị Khu đặc biệt (Chỉ Điểm Rèn Luyện)
  const [filterPage, setFilterPage] = useState<string>('drl');
  
  const [seenIds, setSeenIds] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('seen_facebook_posts');
    return saved ? JSON.parse(saved) : {};
  });

  const loadData = () => {
    fetch(`/data.json?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải dữ liệu');
        return res.json();
      })
      .then((json: DataStore) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (!data) {
           setError('Dữ liệu chưa có sẵn hoặc có lỗi khi tải.');
           setLoading(false);
        }
      });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); 
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) return;

    let changed = false;
    const newSeen = { ...seenIds };

    // Set red dot for DRL posts seen
    if (filterPage === 'all') {
      Object.values(data.pages).flat().forEach(p => {
        if (p.aiData && p.aiData.isDrl && !newSeen[p.id]) { newSeen[p.id] = true; changed = true; }
      });
    } else if (data.pages[filterPage]) {
      data.pages[filterPage].forEach(p => {
        if (p.aiData && p.aiData.isDrl && !newSeen[p.id]) { newSeen[p.id] = true; changed = true; }
      });
    }

    if (changed) {
      setSeenIds(newSeen);
      localStorage.setItem('seen_facebook_posts', JSON.stringify(newSeen));
    }
  }, [filterPage, data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f4f5] p-4 font-sans text-gray-800">
        <div className="bg-white p-8 border border-gray-200 rounded-md text-center max-w-md w-full shadow-sm">
          <h2 className="text-lg font-semibold mb-2 text-red-600">Chưa có dữ liệu</h2>
          <p className="text-sm text-gray-600">Hệ thống chưa thu thập được dữ liệu nào. Hãy chờ Github Actions chạy xong hoặc chạy thủ công.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pageNames = Object.keys(data.pages);
  
  const allPostsFlattened = Object.entries(data.pages).flatMap(([pageName, posts]) => 
    posts.map(post => ({ ...post, pageName }))
  );

  let feedPosts = [...allPostsFlattened];
  if (filterPage === 'drl') {
    feedPosts = feedPosts.filter(p => p.aiData?.isDrl);
  } else if (filterPage !== 'all') {
    feedPosts = feedPosts.filter(p => p.pageName === filterPage);
  }
  feedPosts.sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());

  // Data cho Calendar (Lấy tất cả, filter DRL)
  const calendarEvents = allPostsFlattened.filter(p => p.aiData?.isDrl && p.aiData?.eventTime && p.aiData.eventTime.trim() !== "");

  const checkUnread = (pageTitle?: string) => {
      if (pageTitle === 'drl') {
          return allPostsFlattened.some(p => p.aiData?.isDrl && !seenIds[p.id]);
      } else if (pageTitle) {
          return data.pages[pageTitle]?.some(p => p.aiData?.isDrl && !seenIds[p.id]) || false;
      }
      return Object.values(data.pages).flat().some(p => p.aiData?.isDrl && !seenIds[p.id]);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f8f9fa] font-sans text-slate-800 overflow-hidden">
        
      {/* Sidebar - Cột trái (Nguồn) */}
      <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0 z-10">
        <div className="h-[60px] border-b border-slate-200 px-5 flex items-center shrink-0">
            <svg className="w-5 h-5 text-indigo-600 mr-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h1 className="text-[16px] font-bold text-slate-800">Cổng Theo Dõi ĐRL</h1>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-1">
          <div className="px-3 py-2 mt-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nổi bật</div>
          </div>

          <button 
            onClick={() => setFilterPage('drl')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] transition-all duration-200 ${
              filterPage === 'drl' 
                ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm border border-indigo-200 text-white font-bold leading-none">★</span>
                <span>Chỉ Điểm Rèn Luyện</span>
            </div>
            {filterPage !== 'drl' && checkUnread('drl') && (
               <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-sm shadow-red-500/50"></span>
            )}
          </button>
          
          <div className="my-3 border-t border-slate-100"></div>
          
          <div className="px-3 py-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fanpage</div>
          </div>

          <button 
            onClick={() => setFilterPage('all')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] transition-all duration-200 mb-1 ${
              filterPage === 'all' 
                ? 'bg-slate-100 text-slate-800 font-semibold' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded flex items-center justify-center bg-white shadow-sm border border-slate-200 text-slate-400">❖</span>
                <span>Tất cả đơn vị</span>
            </div>
          </button>

          {pageNames.map(name => {
            const isUnread = filterPage !== name && checkUnread(name);
            return (
              <button 
                key={name}
                onClick={() => setFilterPage(name)}
                className={`w-full flex items-center justify-between px-3 py-2 text-[14px] rounded-lg transition-all duration-200 ${
                  filterPage === name 
                    ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                    : 'bg-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-100 to-white border border-slate-200 flex items-center justify-center font-bold text-[10px] text-indigo-800">
                    {name.substring(0, 1)}
                  </div>
                  <span className="truncate">{name}</span>
                </div>
                {isUnread && (
                    <span className="w-2 h-2 bg-red-500 rounded-full shrink-0 shadow-sm shadow-red-500/50"></span>
                )}
              </button>
            )
          })}
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
             <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Cập nhật: {formatDate(data.lastUpdated).split(" ")[1]}</span>
             </div>
        </div>
      </aside>

      {/* Main Content Pane - Feed */}
      <main className="flex-1 flex flex-col h-full relative border-r border-slate-200 bg-[#f8f9fa]">
        
        <header className="h-[60px] bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
            <div className="flex flex-col">
                <span className="text-[16px] font-bold text-slate-800">
                    {filterPage === 'drl' ? 'Các hoạt động có Điểm Rèn Luyện' : (filterPage === 'all' ? 'Tất cả hoạt động' : filterPage)}
                </span>
                <span className="text-[12px] font-medium text-slate-500">
                    {filterPage === 'drl' 
                      ? `${feedPosts.length} kiện được AI tổng hợp` 
                      : `Đang hiển thị ${feedPosts.length} bài đăng (bao gồm cả bài viết thường)`}
                </span>
            </div>
            <div className="flex space-x-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Gemini Active
                </span>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth hide-scrollbar">
          <div className="max-w-2xl mx-auto space-y-7">
            {feedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 mt-10">
                <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-8 h-8 opacity-50 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                </div>
                <p className="text-[15px] font-medium text-slate-600">
                  {filterPage === 'drl' ? 'Chưa tìm thấy hoạt động ĐRL nào.' : 'Chưa có bài viết nào.'}
                </p>
                <p className="text-[13px] mt-1">Hệ thống AI sẽ tự động cập nhật khi có sự kiện mới.</p>
              </div>
            ) : (
              feedPosts.map((post) => {
                const isNew = !seenIds[post.id];
                return (
                 <article key={post.id} className="relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                  
                  {isNew && (
                    <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 m-4 shadow-sm shadow-red-500/50 z-10 animate-pulse"></div>
                  )}

                  <div className="p-7">
                      <div className="flex items-center gap-4 mb-6">
                          <img 
                            src={`https://ui-avatars.com/api/?name=${post.pageName}&background=4f46e5&color=fff&size=48`} 
                            alt={post.pageName}
                            className="w-12 h-12 rounded-xl shadow-sm"
                          />
                          <div>
                            <h3 className="font-bold text-slate-800 text-[17px] leading-tight">
                              {post.pageName}
                            </h3>
                            <p className="text-[13px] text-slate-500 font-medium mt-1">
                              Cập nhật hệ thống: {formatDate(post.scrapedAt)}
                            </p>
                          </div>
                      </div>

                      {/* Thông tin do AI tổng hợp (chỉ hiện khi có ĐRL) */}
                      {post.aiData?.isDrl ? (
                        <>
                          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mb-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                               <h4 className="text-[14px] font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                                 <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                 </svg>
                                 Phân tích AI
                               </h4>
                               <span className="px-3 py-1 bg-blue-100 text-blue-800 text-[13px] font-bold rounded-md">
                                 +{post.aiData?.activityType || 'Hoạt động'}
                               </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-[14px]">
                               <div>
                                  <span className="block text-[12px] font-bold text-slate-500 uppercase mb-1">Đơn vị tổ chức</span>
                                  <span className="font-semibold text-slate-800 text-[15px]">
                                    {post.aiData?.organizer || 'Chưa rõ'}
                                  </span>
                               </div>
                               <div>
                                  <span className="block text-[12px] font-bold text-slate-500 uppercase mb-1">Thời gian sự kiện</span>
                                  <span className="font-semibold text-slate-800 text-[15px] flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {post.aiData?.eventTime || 'Chưa công bố'}
                                  </span>
                               </div>
                               <div>
                                  <span className="block text-[12px] font-bold text-slate-500 uppercase mb-1">Chi phí tham gia</span>
                                  <span className="font-semibold text-slate-800 text-[15px]">
                                    {post.aiData?.fee || '1 phần thu nhập'}
                                  </span>
                               </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200/60 mt-2">
                                <span className="block text-[12px] font-bold text-slate-500 uppercase mb-2">Cách thức đăng ký</span>
                                <span className="font-semibold text-slate-900 text-[14px] bg-yellow-100/60 px-3 py-2 rounded-md inline-block border border-yellow-200 leading-relaxed shadow-sm">
                                    {post.aiData?.registrationProcess || 'Xem chi tiết trong bài đăng gốc'}
                                </span>
                            </div>
                          </div>

                          {/* Content gốc ẩn bớt */}
                          <details className="text-slate-700 text-[15px] font-sans bg-white border border-slate-200 rounded-xl group shadow-sm">
                              <summary className="px-5 py-4 font-semibold cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors rounded-xl">
                                <span>Đọc toàn bộ nội dung bài đăng gốc</span>
                                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                              </summary>
                              <div className="px-5 pb-5 pt-2 whitespace-pre-wrap leading-relaxed border-t border-slate-100 text-slate-600 mt-1">
                                 {post.text}
                              </div>
                          </details>
                        </>
                      ) : (
                        <div className="text-slate-700 text-[15px] font-sans leading-relaxed mb-4 whitespace-pre-wrap">
                          {post.text}
                        </div>
                      )}
                  </div>

                  <div className="bg-slate-50 px-7 py-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[12px] font-semibold text-slate-500">
                      Đăng tải gốc lúc: {formatDate(post.time || post.scrapedAt)}
                    </span>
                    <a 
                      href={post.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-[14px] font-bold rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2 transform hover:-translate-y-0.5"
                    >
                      Mở liên kết gốc
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  </div>
                </article>
              )})
            )}
          </div>
        </div>
      </main>

      {/* Right Sidebar - Calendar */}
      <aside className="w-[320px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 z-10 hidden lg:flex">
          <div className="h-[60px] border-b border-slate-200 px-5 flex items-center shrink-0">
             <svg className="w-5 h-5 text-indigo-500 mr-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
             <h2 className="text-[16px] font-bold text-slate-800">Lịch Hoạt Động</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 hide-scrollbar">
             {calendarEvents.length === 0 ? (
                <div className="text-center p-4 border border-dashed border-slate-200 rounded-lg">
                    <p className="text-[13px] text-slate-500 font-medium">Chưa có lịch trình sự kiện nào.</p>
                </div>
             ) : (
                calendarEvents.map((evt, idx) => (
                   <div key={`cal-${idx}`} className="relative pl-6 pb-4 border-l-2 border-slate-100 last:border-0 last:pb-0">
                      <span className="absolute left-[-5px] top-1 w-[8px] h-[8px] rounded-full bg-indigo-500 ring-4 ring-white"></span>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-indigo-100 transition-colors shadow-sm">
                         <h4 className="font-bold text-[13px] text-slate-800 leading-tight mb-1">
                            {evt.aiData?.activityType} bởi {evt.aiData?.organizer}
                         </h4>
                         <p className="text-[12px] font-semibold text-indigo-600 flex items-center gap-1.5 mb-2">
                            <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {evt.aiData?.eventTime}
                         </p>
                         <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {evt.aiData?.registrationProcess}
                         </p>
                      </div>
                   </div>
                ))
             )}
          </div>
          
          <div className="p-4 bg-gradient-to-t from-white to-transparent shrink-0">
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 flex items-start gap-3">
                  <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 rounded">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[11px] font-medium text-indigo-800 leading-relaxed">
                      Lịch được tổng hợp AI. Vui lòng check lại bài đăng gốc để đảm bảo độ rủi ro chính xác.
                  </p>
              </div>
          </div>
      </aside>

      {/* Global CSS for scrollbars */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
      `}</style>
    </div>
  );
}

export default App;
