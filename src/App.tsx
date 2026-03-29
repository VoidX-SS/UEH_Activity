import { useEffect, useState } from 'react';

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

function App() {
  const [data, setData] = useState<DataStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPage, setFilterPage] = useState<string>('all');
  
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
  }, []);

  useEffect(() => {
    if (!data) return;

    let changed = false;
    const newSeen = { ...seenIds };

    if (filterPage === 'all') {
      Object.values(data.pages).flat().forEach(p => {
        if (!newSeen[p.id]) { newSeen[p.id] = true; changed = true; }
      });
    } else if (data.pages[filterPage]) {
      data.pages[filterPage].forEach(p => {
        if (!newSeen[p.id]) { newSeen[p.id] = true; changed = true; }
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f4f5] p-4 font-sans text-gray-800">
        <div className="bg-white p-8 border border-gray-200 rounded-md text-center max-w-md w-full">
          <h2 className="text-lg font-semibold mb-2">Chưa có dữ liệu</h2>
          <p className="text-sm text-gray-600">Hệ thống chưa thu thập được dữ liệu nào. Hãy chờ Github Actions chạy xong hoặc quét thủ công bằng NPM.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pageNames = Object.keys(data.pages);
  
  let allPosts = Object.entries(data.pages).flatMap(([pageName, posts]) => 
    posts.map(post => ({ ...post, pageName }))
  );

  if (filterPage !== 'all') {
    allPosts = allPosts.filter(p => p.pageName === filterPage);
  }

  allPosts.sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());

  const checkUnread = (pageTitle?: string) => {
      if (pageTitle) {
          return data.pages[pageTitle]?.some(p => !seenIds[p.id]) || false;
      }
      return Object.values(data.pages).flat().some(p => !seenIds[p.id]);
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
    <div className="flex h-screen w-full bg-[#f4f4f5] font-sans text-[#1a1a1a] overflow-hidden">
        
      {/* Sidebar - Lấy cảm hứng từ giao diện cổ điển, viền mảnh, nền trắng */}
      <aside className="w-[320px] bg-white border-r border-[#e5e5e5] flex flex-col h-full shrink-0 z-10 transition-transform">
        
        {/* Header của Sidebar */}
        <div className="h-14 border-b border-[#e5e5e5] px-4 flex items-center shrink-0">
            <svg className="w-5 h-5 text-gray-700 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <h1 className="text-[15px] font-semibold tracking-wide">Bảng Điều Khiển</h1>
        </div>

        {/* Nội dung danh sách trang */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-1">
          <div className="px-3 py-2">
            <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Thiết lập theo dõi</div>
          </div>

          <button 
            onClick={() => setFilterPage('all')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-[14px] transition-colors border ${
              filterPage === 'all' 
                ? 'bg-gray-50 border-[#e5e5e5] font-medium text-black' 
                : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Tất cả nguồn tin</span>
            </div>
            {filterPage !== 'all' && checkUnread() && (
               <span className="w-2 h-2 bg-gray-800 rounded-full"></span>
            )}
          </button>
          
          <div className="my-2 border-t border-gray-100"></div>

          {pageNames.map(name => {
            const isUnread = filterPage !== name && checkUnread(name);
            return (
              <button 
                key={name}
                onClick={() => setFilterPage(name)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-[14px] rounded-md transition-colors border ${
                  filterPage === name 
                    ? 'bg-gray-50 border-[#e5e5e5] font-medium text-black' 
                    : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                  <span className="truncate">{name}</span>
                </div>
                {isUnread && (
                    <span className="w-2 h-2 bg-gray-800 rounded-full shrink-0"></span>
                )}
              </button>
            )
          })}
        </div>
        
        {/* Footer của Sidebar */}
        <div className="p-4 border-t border-[#e5e5e5] bg-gray-50 shrink-0">
             <div className="flex items-center gap-2 text-[12px] text-gray-500">
                <svg className="w-3.5 h-3.5 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Cập nhật: {formatDate(data.lastUpdated)}</span>
             </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col h-full bg-[#f4f4f5] relative">
        
        {/* Header Main Pane */}
        <header className="h-14 bg-white border-b border-[#e5e5e5] flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-2 text-[15px] font-medium text-gray-800">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              {filterPage === 'all' ? 'Tất cả bài viết' : filterPage}
            </div>
            <div className="text-[13px] text-gray-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {allPosts.length} kết quả
            </div>
        </header>

        {/* Scrollable Feed */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth hide-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            {allPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-[14px]">Cuộc trò chuyện sẽ xuất hiện ở đây.</p>
                <p className="text-[13px] text-gray-400 mt-1">Định cấu hình theo dõi cài đặt ở thanh bên trái.</p>
              </div>
            ) : (
              allPosts.map((post) => (
                <article key={post.id} className="bg-white rounded-lg border border-[#e5e5e5] p-5 md:p-6 text-[14px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#f0f0f0]">
                    <div className="flex items-center gap-3">
                       {/* Icon vuông đen/xám tối thay vì avatar tròn sặc sỡ */}
                       <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 font-medium text-[12px] uppercase">
                          {post.pageName.substring(0, 1)}
                       </div>
                       <div>
                          <h3 
                            className="font-medium text-black cursor-pointer hover:underline text-[14px]"
                            onClick={() => setFilterPage(post.pageName)}
                          >
                            {post.pageName}
                          </h3>
                          <p className="text-[12px] text-gray-500 mt-0.5">{formatDate(post.scrapedAt)}</p>
                       </div>
                    </div>
                  </div>
                  
                  <div className="text-gray-800 whitespace-pre-wrap font-serif md:font-sans">
                    {post.text}
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#f0f0f0] flex justify-end">
                    <a 
                      href={post.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#1C1C1C] hover:bg-black text-white text-[13px] font-medium rounded-md transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Chuyển đến Bài viết
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Global CSS for scrollbars and animations */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .hide-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .hide-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e5e5e5;
          border-radius: 10px;
        }
        .animate-spin-slow {
          animation: spin 4s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default App;
