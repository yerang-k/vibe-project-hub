// ==========================================================================
// Vibe Project Hub - Client Logic Script
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Core State
  let projects = [];
  let currentFilterStatus = 'all';
  let currentSearchQuery = '';
  let currentFolder = null; // null = 폴더 목록 화면, 값 = 그 폴더 안을 보는 중
  let currentView = localStorage.getItem('vibe_view') || 'folders'; // 'folders' | 'list'(전체 목록)
  let currentLayout = localStorage.getItem('vibe_layout') || 'cards'; // 폴더 안 보기: 'cards' | 'list'

  // --- 용도(폴더) 분류 ---
  // 형식(Web App/GAS)이 아니라 "무엇에 쓰는 앱인지"로 묶는다.
  const PURPOSE_ORDER = ['수업·학습', '교무·행정', '자료·참고', '행사·이벤트', '개인·생활'];
  // 값은 Lucide 아이콘 이름 (페이지 톤에 맞춘 얇은 라인 아이콘)
  const PURPOSE_META = {
    '수업·학습': 'graduation-cap',
    '교무·행정': 'briefcase',
    '자료·참고': 'archive',
    '행사·이벤트': 'calendar-days',
    '개인·생활': 'coffee',
  };

  // 기존 13개 앱은 시트의 category가 아직 옛 형식값이라, id로 용도를 지정한다.
  // ponytail: 이 id 지도는 레거시 13행을 위한 일회용 다리다. 새로 등록하는
  // 앱은 드롭다운에서 고른 용도가 category에 저장되므로 지도가 필요 없다.
  // 레거시 행들을 용도로 한 번씩 다시 저장하면 이 지도는 삭제해도 된다.
  const PURPOSE_BY_ID = {
    1787038818779: '자료·참고',   // 선생님의 AI 활용 자료 정리
    1786972088506: '행사·이벤트', // 훈민정음 대탈출
    1786507996213: '수업·학습',   // 탐구 여정 내비게이터
    1785412828931: '교무·행정',   // 정보부 스마트 지원 센터
    1784992840859: '수업·학습',   // 국어 수업용 슬라이드 에디터
    1784254469227: '교무·행정',   // 통합연수등록시스템
    1784170473448: '교무·행정',   // HWP AI 계획서 생성기
    1783872218509: '교무·행정',   // 카페 주문 수합 앱
    1783871686681: '개인·생활',   // 후쿠오카 가족 여행 지도
    1783869549436: '수업·학습',   // 바른 글AI
    1783869039649: '수업·학습',   // 수행평가 점수 확인 앱
    1783868963876: '교무·행정',   // 교사도우미
    1783868771469: '수업·학습',   // 음운 변동 퀴즈 앱
  };
  const purposeOf = (p) => PURPOSE_BY_ID[p.id] || p.category || '기타';

  // 2. DOM Elements
  const projectsGrid = document.getElementById('projects-grid');
  const searchInput = document.getElementById('search-input');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const btnOpenModal = document.getElementById('btn-open-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const projectModal = document.getElementById('project-modal');
  const projectForm = document.getElementById('project-form');
  
  // Stats Elements
  const statTotal = document.getElementById('stat-total');
  const statCompleted = document.getElementById('stat-completed');
  const statProgress = document.getElementById('stat-progress');
  const statIdea = document.getElementById('stat-idea');

  // Footer Actions
  const btnCopyJson = document.getElementById('btn-copy-json');
  const btnDownloadJson = document.getElementById('btn-download-json');
  const toast = document.getElementById('toast');

  // New Interactive Elements
  const projTechInput = document.getElementById('proj-tech');
  const btnAnalyzeDemo = document.getElementById('btn-analyze-demo');
  const btnAnalyzeRepo = document.getElementById('btn-analyze-repo');
  const stackChips = document.querySelectorAll('.stack-chip');

  // Google Sheets Sync Settings Elements
  const syncIndicator = document.getElementById('sync-indicator');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnClearSettings = document.getElementById('btn-clear-settings');
  const btnShareSettings = document.getElementById('btn-share-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsApiUrlInput = document.getElementById('settings-api-url');

  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbwnLDMELObAxmve5uoGoTIkCW7JdGJgdlqSGeyEma06Zr2KsUG3_2ujV6eVa0_lWFhAFQ/exec';

  // Get active Sheet API URL (Local Storage preference OR Default hardcoded GAS Web App URL)
  function getSheetApiUrl() {
    const saved = localStorage.getItem('sheet_api_url');
    if (saved === 'none') {
      return null; // Explicitly disabled
    }
    if (!saved) {
      return DEFAULT_API_URL; // Fallback default
    }
    return saved; // User custom URL
  }

  // 3. Init Function
  async function init() {
    // Initialize Lucide icons on page load
    lucide.createIcons();
    
    // Check URL parameters for api url auto-save
    const urlParams = new URLSearchParams(window.location.search);
    const apiParam = urlParams.get('api');
    if (apiParam) {
      const trimmedApi = apiParam.trim();
      if (trimmedApi.startsWith('https://script.google.com/')) {
        localStorage.setItem('sheet_api_url', trimmedApi);
        showToast('구글 시트 연동 주소가 자동으로 등록되었습니다!');
        
        // Clean URL parameter so it looks neat
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        window.history.replaceState({path: cleanUrl}, '', cleanUrl);
      } else if (trimmedApi === 'none') {
        localStorage.setItem('sheet_api_url', 'none');
        showToast('구글 시트 연동이 해제되었습니다.');
        
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        window.history.replaceState({path: cleanUrl}, '', cleanUrl);
      }
    }

    updateSyncIndicator();

    const sheetApiUrl = getSheetApiUrl();
    if (sheetApiUrl) {
      await fetchFromGoogleSheets(sheetApiUrl);
    } else {
      // Offline/Local mode loading
      const savedData = localStorage.getItem('vibe_projects');
      if (savedData) {
        try {
          projects = JSON.parse(savedData);
          render();
        } catch (e) {
          console.error('Failed to parse saved projects', e);
          await fetchProjectsFromJson();
        }
      } else {
        await fetchProjectsFromJson();
      }
    }

    setupEventListeners();
  }

  // Update visual state of Sheets Integration Indicator
  // state: 'syncing' 시도 중 | 'synced' 성공 | 'failed' 실패(낡은 데이터 표시 중) | 'local' 연동 해제
  // 인자를 생략하면 아직 시도 전이라는 뜻으로, 설정값만 보고 표시합니다.
  function updateSyncIndicator(state) {
    const text = syncIndicator.querySelector('.indicator-text');
    if (!state) {
      state = getSheetApiUrl() ? 'syncing' : 'local';
    }

    if (state === 'syncing') {
      syncIndicator.className = 'sync-indicator api-mode';
      text.textContent = 'Google Sheets 동기화 중...';
    } else if (state === 'synced') {
      syncIndicator.className = 'sync-indicator api-mode';
      text.textContent = 'Google Sheets 동기화됨';
    } else if (state === 'failed') {
      syncIndicator.className = 'sync-indicator error-mode';
      text.textContent = '시트 연결 실패 · 저장된 데이터 표시 중';
    } else {
      syncIndicator.className = 'sync-indicator local-mode';
      text.textContent = '로컬 단독 모드';
    }
  }

  // Fetch live projects from Google Sheets via Web App API
  async function fetchFromGoogleSheets(apiUrl) {
    projectsGrid.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Google Sheets에서 데이터 동기화 중...</p>
      </div>
    `;
    lucide.createIcons();

    try {
      // Prevent browser cache on GET requests
      const cacheBustUrl = apiUrl + (apiUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      const response = await fetch(cacheBustUrl);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          projects = data;
          saveToLocalStorage(); // Cache it locally
          render();
          updateSyncIndicator('synced');
        } else {
          console.error('GAS response is not array', data);
          showToast('동기화 실패: 데이터 형식이 잘못되었습니다.');
          updateSyncIndicator('failed');
          loadLocalFallback();
        }
      } else {
        showToast('구글 시트 로드 실패. 로컬 캐시를 불러옵니다.');
        updateSyncIndicator('failed');
        loadLocalFallback();
      }
    } catch (err) {
      console.error('Sheets sync error:', err);
      showToast('네트워크 오류: 로컬 오프라인 데이터로 구동합니다.');
      updateSyncIndicator('failed');
      loadLocalFallback();
    }
  }

  // Local fallback runner if Sheets fetch fails
  function loadLocalFallback() {
    const savedData = localStorage.getItem('vibe_projects');
    if (savedData) {
      try {
        projects = JSON.parse(savedData);
        render();
      } catch (e) {
        fetchProjectsFromJson();
      }
    } else {
      fetchProjectsFromJson();
    }
  }

  // Fetch initial config from JSON file
  async function fetchProjectsFromJson() {
    try {
      const response = await fetch('projects.json');
      if (response.ok) {
        projects = await response.json();
        saveToLocalStorage();
        render();
      } else {
        loadFallbackData();
      }
    } catch (err) {
      console.warn('Fetch failed (CORS or server error). Using fallback embedded data.', err);
      loadFallbackData();
    }
  }

  // Fallback default data for offline/local run without server
  function loadFallbackData() {
    projects = [
      {
        "id": 1,
        "title": "Gemini Antigravity Extension",
        "description": "AI 에이전트를 로컬 개발 환경과 연결하여 실시간 코딩 및 리서치를 보조하는 강력한 Chrome 확장 프로그램입니다.",
        "status": "completed",
        "category": "Chrome Extension",
        "techStack": ["JavaScript", "HTML", "Chrome API", "CSS"],
        "aiTools": "Gemini 3.5 Flash",
        "promptSummary": "Chrome 확장 프로그램의 백그라운드 스크립트와 사이드패널 간 양방향 메시지 통신을 구현하고, 예외 처리가 가미된 표준 보일러플레이트 코드를 작성해줘.",
        "demoUrl": "https://example.com/demo-antigravity",
        "repoUrl": "https://github.com/user/gemini-antigravity",
        "createdAt": "2026-07-10"
      },
      {
        "id": 2,
        "title": "AI Email Autowriter",
        "description": "수신된 이메일의 맥락과 톤앤매너를 분석하여 상황별 맞춤 답장 초안을 원클릭으로 작성해주는 PyQt6 데스크톱 프로그램입니다.",
        "status": "in-progress",
        "category": "Desktop App",
        "techStack": ["Python", "PyQt6", "Gemini API"],
        "aiTools": "Claude 3.5 Sonnet",
        "promptSummary": "PyQt6 환경에서 QThread와 Worker 패턴을 사용해 백그라운드에서 API 요청을 처리하고, UI가 멈추지 않는 로딩 스피너 애니메이션을 구현해줘.",
        "demoUrl": "",
        "repoUrl": "https://github.com/user/email-autowriter",
        "createdAt": "2026-07-11"
      },
      {
        "id": 3,
        "title": "Smart Scheduler Bot",
        "description": "대화형 자연어 메신저 대화 속에서 날짜, 시간, 약속 내용을 추출해 캘린더 일정을 자동 스케줄링해주는 Discord 봇입니다.",
        "status": "idea",
        "category": "Bot / CLI",
        "techStack": ["Node.js", "Discord.js", "Google Calendar API"],
        "aiTools": "GPT-4o",
        "promptSummary": "자연어 문장(예: 내일 오후 3시에 철수와 미팅 있어)에서 날짜, 시간, 제목을 정확하게 ISO8601 포맷의 JSON으로 매핑해주는 OpenAI 시스템 프롬프트를 설계해줘.",
        "demoUrl": "",
        "repoUrl": "",
        "createdAt": "2026-07-12"
      }
    ];
    saveToLocalStorage();
    render();
  }

  // Save changes to localStorage
  function saveToLocalStorage() {
    localStorage.setItem('vibe_projects', JSON.stringify(projects, null, 2));
  }

  // 4. Render Layout & Cards
  function render() {
    updateStats();

    // Filter projects
    const filteredProjects = projects.filter(project => {
      const matchesStatus = currentFilterStatus === 'all' || project.status === currentFilterStatus;
      
      const query = currentSearchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        project.title.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        project.techStack.some(tech => tech.toLowerCase().includes(query)) ||
        (project.aiTools && project.aiTools.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });

    // 표시 순서: createdAt 내림차순 (안정 정렬). '맨 앞으로 보내기'가 createdAt를
    // 현재 시각으로 바꿔, 그 앱이 자기 폴더 맨 앞에 오도록 한다.
    filteredProjects.sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    // Empty state check
    if (filteredProjects.length === 0) {
      projectsGrid.innerHTML = `
        <div class="empty-state">
          <i data-lucide="folder-open" style="width: 48px; height: 48px; color: var(--text-muted);"></i>
          <p>일치하는 프로젝트가 없습니다.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // 앱 한 개를 목록(행)으로 렌더 (전체 목록 + 폴더 안 목록 보기 공용)
    const renderRow = (project) => {
        let statusClass = 'idea', statusLabel = '아이디어';
        if (project.status === 'completed') { statusClass = 'completed'; statusLabel = '완료'; }
        else if (project.status === 'in-progress') { statusClass = 'in-progress'; statusLabel = '개발 중'; }

        const isAdmin = localStorage.getItem('sheet_api_url') !== null;
        const demoLocked = /script\.google\.com\/a\/macros\//.test(project.demoUrl || '') && !isAdmin;
        const demoUsable = !!project.demoUrl && !demoLocked;
        const demoClass = demoUsable ? '' : 'disabled';
        const repoClass = project.repoUrl ? '' : 'disabled';

        return `
          <div class="app-row" data-id="${project.id}">
            <div class="app-row-main">
              <div class="app-row-head">
                <h3>${escapeHtml(project.title)}</h3>
                <span class="row-category">${escapeHtml(purposeOf(project))}</span>
                <span class="badge-status ${statusClass}"><span class="status-dot"></span>${statusLabel}</span>
              </div>
              <p class="app-row-desc">${escapeHtml(project.description)}</p>
            </div>
            <div class="app-row-actions">
              <div class="card-admin-tools">
                <button type="button" class="btn-admin-icon btn-edit" title="수정" data-id="${project.id}"><i data-lucide="edit-3"></i></button>
                <button type="button" class="btn-admin-icon btn-delete" title="삭제" data-id="${project.id}"><i data-lucide="trash-2"></i></button>
              </div>
              <a href="${demoUsable ? project.demoUrl : '#'}" class="action-link ${demoClass}" target="_blank" rel="noopener"><i data-lucide="external-link"></i> 데모</a>
              <a href="${project.repoUrl || '#'}" class="action-link ${repoClass}" target="_blank" rel="noopener"><svg class="icon-github" viewBox="0 0 16 16" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg> 깃허브</a>
            </div>
          </div>`;
    };

    // 전체 목록 보기: 폴더 없이 모든 앱을 한 페이지에 목록으로
    if (currentView === 'list') {
      projectsGrid.innerHTML = `<div class="app-list">${filteredProjects.map(renderRow).join('')}</div>`;
      lucide.createIcons();
      return;
    }

    // Build a single card's HTML (grouped into category folders below)
    const renderCard = (project) => {
      // Status mapping
      let statusClass = 'idea';
      let statusLabel = '아이디어';
      if (project.status === 'completed') {
        statusClass = 'completed';
        statusLabel = '완료';
      } else if (project.status === 'in-progress') {
        statusClass = 'in-progress';
        statusLabel = '개발 중';
      }

      // Tech tags HTML
      const techTagsHtml = project.techStack
        .map(tech => `<span class="tag-tech">${tech.trim()}</span>`)
        .join('');

      // Links validity — 학교 도메인 전용 데모(/a/macros/도메인/)는 외부 방문자가
      // 로그인 벽에 막혀 못 여니, 비관리자에게는 데모 버튼을 비활성 처리한다.
      const isAdmin = localStorage.getItem('sheet_api_url') !== null;
      const demoLocked = /script\.google\.com\/a\/macros\//.test(project.demoUrl || '') && !isAdmin;
      const demoUsable = !!project.demoUrl && !demoLocked;
      const demoClass = demoUsable ? '' : 'disabled';
      const repoClass = project.repoUrl ? '' : 'disabled';

      // Prompt section (if exists)
      const promptSectionHtml = project.promptSummary 
        ? `
        <div class="card-vibe-box">
          <div class="vibe-title">
            <i data-lucide="zap"></i>
            <span>VIBE PROMPT</span>
          </div>
          <div class="vibe-prompt">${escapeHtml(project.promptSummary)}</div>
        </div>
        ` 
        : '';

      return `
        <article class="project-card glass-card" data-id="${project.id}">
          <div class="card-header">
            <div class="card-header-right">
              <div class="card-admin-tools">
                <button type="button" class="btn-admin-icon drag-handle" title="드래그해서 순서 변경" data-id="${project.id}">
                  <i data-lucide="grip-vertical"></i>
                </button>
                <button type="button" class="btn-admin-icon btn-edit" title="수정" data-id="${project.id}">
                  <i data-lucide="edit-3"></i>
                </button>
                <button type="button" class="btn-admin-icon btn-delete" title="삭제" data-id="${project.id}">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
              <span class="badge-status ${statusClass}">
                <span class="status-dot"></span>
                ${statusLabel}
              </span>
            </div>
          </div>
          <h2>${escapeHtml(project.title)}</h2>
          <p class="card-desc">${escapeHtml(project.description)}</p>
          
          <div class="card-tech-stack">
            ${techTagsHtml}
          </div>

          ${promptSectionHtml}

          <div class="card-actions">
            <div class="ai-tool-info">
              <i data-lucide="cpu"></i>
              <span>${escapeHtml(project.aiTools || 'AI 비지정')}</span>
            </div>
            <div class="action-links">
              <a href="${demoUsable ? project.demoUrl : '#'}" class="action-link ${demoClass}" target="_blank" rel="noopener">
                <i data-lucide="external-link"></i> 데모
              </a>
              <a href="${project.repoUrl || '#'}" class="action-link ${repoClass}" target="_blank" rel="noopener">
                <svg class="icon-github" viewBox="0 0 16 16" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg> 깃허브
              </a>
            </div>
          </div>
        </article>
      `;
    };

    // Group into purpose folders
    const groups = new Map();
    filteredProjects.forEach(p => {
      const key = purposeOf(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });

    // Folder order: known purposes first, then any extras
    const folderNames = [
      ...PURPOSE_ORDER.filter(n => groups.has(n)),
      ...[...groups.keys()].filter(n => !PURPOSE_ORDER.includes(n)),
    ];

    if (currentSearchQuery.trim()) {
      // 검색 중엔 폴더를 파고들 필요 없이 전체에서 바로 찾아 보여준다
      projectsGrid.innerHTML =
        `<div class="folder-grid">${filteredProjects.map(renderCard).join('')}</div>`;
    } else if (currentFolder && groups.has(currentFolder)) {
      // 폴더 안 화면 — 카드 또는 목록 레이아웃
      const items = groups.get(currentFolder);
      const body = currentLayout === 'list'
        ? `<div class="app-list">${items.map(renderRow).join('')}</div>`
        : `<p class="reorder-hint">손잡이 <i data-lucide="grip-vertical"></i> 를 끌어 순서를 바꿀 수 있어요</p>
           <div class="folder-grid reorderable">${items.map(renderCard).join('')}</div>`;
      projectsGrid.innerHTML = `
        <button type="button" class="folder-back">
          <i data-lucide="arrow-left"></i> 전체 폴더
        </button>
        <div class="folder-open-head">
          <i data-lucide="${PURPOSE_META[currentFolder] || 'folder'}" class="folder-open-icon"></i>
          <span class="folder-open-name">${escapeHtml(currentFolder)}</span>
          <span class="folder-count">${items.length}</span>
          <div class="layout-toggle">
            <button type="button" class="layout-btn ${currentLayout === 'cards' ? 'active' : ''}" data-layout="cards" title="카드로 보기"><i data-lucide="layout-grid"></i></button>
            <button type="button" class="layout-btn ${currentLayout === 'list' ? 'active' : ''}" data-layout="list" title="목록으로 보기"><i data-lucide="list"></i></button>
          </div>
        </div>
        ${body}
      `;
    } else {
      // 폴더 목록(홈) 화면 — 폴더 아이콘만 보여준다
      currentFolder = null;
      projectsGrid.innerHTML = `
        <div class="folder-tiles">
          ${folderNames.map(name => `
            <button type="button" class="folder-tile" data-folder="${escapeHtml(name)}">
              <i data-lucide="${PURPOSE_META[name] || 'folder'}" class="folder-tile-icon"></i>
              <span class="folder-tile-name">${escapeHtml(name)}</span>
              <span class="folder-tile-count">${groups.get(name).length}개</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    // Re-initialize icons inside dynamic elements
    lucide.createIcons();

    // 폴더 안 화면에서 카드 드래그 순서 변경 활성화 (관리자 전용)
    if (currentFolder && !currentSearchQuery.trim()) {
      enableDragReorder(projectsGrid.querySelector('.reorderable'));
    }
  }

  // ---- 카드 드래그로 폴더 안 순서 바꾸기 (관리자 전용, 폰·PC 모두) ----
  function enableDragReorder(grid) {
    if (!grid || localStorage.getItem('sheet_api_url') === null) return;
    let drag = null;

    // 위치가 실제로 바뀔 때만 카드들을 부드럽게(FLIP) 미끄러뜨려 이동시킨다.
    const applyMove = (ref) => {
      if (ref === drag.lastRef) return;
      drag.lastRef = ref;
      const cards = [...grid.querySelectorAll('.project-card')];
      const first = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
      if (ref === 'end') grid.appendChild(drag.card);
      else grid.insertBefore(drag.card, ref);
      cards.forEach(c => {
        const a = first.get(c), b = c.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (!dx && !dy) return;
        c.style.transition = 'none';
        c.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          c.style.transition = 'transform 400ms ease';
          c.style.transform = '';
        });
      });
    };

    const onMove = (e) => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true;
        drag.card.classList.add('dragging');
      }
      e.preventDefault();
      applyMove(cardBeforePoint(grid, e.clientX, e.clientY, drag.card));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!drag) return;
      const moved = drag.moved;
      drag.card.classList.remove('dragging');
      drag = null;
      if (moved) persistOrderFromDom(grid);
    };

    grid.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button > 0) return; // 왼쪽 버튼/터치만
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      const card = handle.closest('.project-card');
      if (!card) return;
      e.preventDefault();
      drag = { card, sx: e.clientX, sy: e.clientY, moved: false };
      handle.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  }

  // 포인터 위치에서 드래그 카드를 그 '앞'에 넣을 기준 카드를 찾는다(없으면 'end').
  function cardBeforePoint(grid, x, y, exclude) {
    const cards = [...grid.querySelectorAll('.project-card')].filter(c => c !== exclude);
    let best = null, bestDist = Infinity, before = 'end';
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestDist) {
        bestDist = d;
        before = (y < cy || (Math.abs(y - cy) < 6 && x < cx)) ? c : c.nextElementSibling;
      }
    }
    return before || 'end';
  }

  // DOM에 나타난 새 순서대로 createdAt를 내림차순 재부여하고 시트/로컬에 저장한다.
  async function persistOrderFromDom(grid) {
    const ids = [...grid.querySelectorAll('.project-card')].map(c => Number(c.dataset.id));
    const base = Date.now();
    ids.forEach((id, i) => {
      const p = projects.find(x => x.id === id);
      if (p) p.createdAt = new Date(base - i * 60000).toISOString();
    });

    const changed = ids.map(id => projects.find(x => x.id === id)).filter(Boolean);
    const sheetApiUrl = getSheetApiUrl();

    if (sheetApiUrl) {
      showToast('순서를 저장하는 중...');
      try {
        for (const p of changed) {
          const res = await fetch(sheetApiUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'update', data: p }),
            headers: { 'Content-Type': 'text/plain' },
            redirect: 'follow'
          });
          if (!res.ok || (await res.json()).status !== 'success') {
            showToast('순서 저장 중 오류가 발생했습니다.');
            break;
          }
        }
        showToast('순서가 저장되었습니다.');
      } catch (err) {
        console.error('Reorder save error:', err);
        showToast('네트워크 오류: 순서를 저장하지 못했습니다.');
      }
    }
    saveToLocalStorage();
    render();
  }

  // Update top statistics panel
  function updateStats() {
    const total = projects.length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const progress = projects.filter(p => p.status === 'in-progress').length;
    const idea = projects.filter(p => p.status === 'idea').length;

    statTotal.textContent = total;
    statCompleted.textContent = completed;
    statProgress.textContent = progress;
    statIdea.textContent = idea;
  }

  // 5. Helper Utilities
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 2500);
  }

  // 6. Setup Event Listeners
  function setupEventListeners() {
    // Real-time search input
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      render();
    });

    // Filter tabs
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterStatus = btn.dataset.status;
        render();
      });
    });

    // 보기 전환 (폴더 / 전체 목록)
    const viewButtons = document.querySelectorAll('.view-btn');
    const syncViewButtons = () => viewButtons.forEach(b =>
      b.classList.toggle('active', b.dataset.view === currentView));
    syncViewButtons();
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = btn.dataset.view;
        localStorage.setItem('vibe_view', currentView);
        currentFolder = null; // 목록↔폴더 전환 시 폴더 안에 갇히지 않도록 초기화
        syncViewButtons();
        render();
      });
    });

    // Modal open / close trigger
    btnOpenModal.addEventListener('click', () => {
      // Reset headers to "Create" mode
      document.querySelector('.modal-header h2').innerHTML = '<i data-lucide="folder-plus"></i> 새 프로젝트 등록';
      document.querySelector('#project-form button[type="submit"]').textContent = '등록하기';
      
      projectModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    const closeModal = () => {
      projectModal.classList.remove('active');
      projectForm.reset();
      document.getElementById('proj-id').value = ''; // Reset hidden ID
      document.body.style.overflow = '';
    };

    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    projectModal.addEventListener('click', (e) => {
      if (e.target === projectModal) closeModal();
    });

    // Submit new or edited project (Hybrid: Local vs Google Sheets API)
    projectForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const projIdVal = document.getElementById('proj-id').value;
      const title = document.getElementById('proj-title').value;
      const status = document.getElementById('proj-status').value;
      const category = document.getElementById('proj-category').value;
      const description = document.getElementById('proj-description').value;
      const techInput = document.getElementById('proj-tech').value;
      const aiTools = document.getElementById('proj-ai').value;
      const promptSummary = document.getElementById('proj-prompt').value;
      let demoUrl = document.getElementById('proj-demo').value.trim();
      let repoUrl = document.getElementById('proj-repo').value.trim();

      if (demoUrl) demoUrl = formatUrl(demoUrl);
      if (repoUrl) repoUrl = formatUrl(repoUrl);

      // Parse comma-separated tech stack
      const techStack = techInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const submitBtn = projectForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      
      const sheetApiUrl = getSheetApiUrl();

      if (sheetApiUrl) {
        // --- 1. GOOGLE SHEETS SYNC MODE ---
        submitBtn.disabled = true;
        submitBtn.textContent = '구글 시트 저장 중...';

        const targetId = projIdVal ? parseInt(projIdVal) : Date.now();
        const createdAt = projIdVal 
          ? (projects.find(p => p.id === targetId)?.createdAt || new Date().toISOString().split('T')[0])
          : new Date().toISOString().split('T')[0];

        const projectData = {
          id: targetId,
          title,
          status,
          category,
          description,
          techStack,
          aiTools,
          promptSummary,
          demoUrl,
          repoUrl,
          createdAt
        };

        const payload = {
          action: projIdVal ? 'update' : 'add',
          data: projectData
        };

        try {
          // Google Apps Script Web App redirect requires redirect: 'follow'
          const response = await fetch(sheetApiUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' }, // Bypass preflight CORS checks
            redirect: 'follow'
          });

          if (response.ok) {
            const resData = await response.json();
            if (resData.status === 'success') {
              if (projIdVal) {
                const idx = projects.findIndex(p => p.id === targetId);
                if (idx > -1) projects[idx] = projectData;
              } else {
                projects.unshift(projectData);
              }
              saveToLocalStorage();
              render();
              closeModal();
              showToast(projIdVal ? '정보가 수정되었습니다!' : '새 프로젝트가 등록되었습니다!');
            } else {
              showToast('구글 시트 연동 실패: ' + resData.message);
            }
          } else {
            showToast('연동 서버 응답 오류가 발생했습니다.');
          }
        } catch (err) {
          console.error('GAS POST error:', err);
          showToast('네트워크 오류: 구글 시트 연동 저장에 실패했습니다.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      } else {
        // --- 2. LOCAL ONLY MODE ---
        if (projIdVal) {
          const targetId = parseInt(projIdVal);
          const index = projects.findIndex(p => p.id === targetId);
          if (index > -1) {
            projects[index] = {
              ...projects[index],
              title,
              status,
              category,
              description,
              techStack,
              aiTools,
              promptSummary,
              demoUrl,
              repoUrl
            };
            saveToLocalStorage();
            render();
            closeModal();
            showToast('프로젝트 정보가 수정되었습니다!');
          } else {
            showToast('수정 오류: 대상을 찾을 수 없습니다.');
          }
        } else {
          const newProject = {
            id: Date.now(),
            title,
            status,
            category,
            description,
            techStack,
            aiTools,
            promptSummary,
            demoUrl,
            repoUrl,
            createdAt: new Date().toISOString().split('T')[0]
          };

          projects.unshift(newProject);
          saveToLocalStorage();
          render();
          closeModal();
          showToast('새 프로젝트가 등록되었습니다!');
        }
      }
    });

    // Auto prefix https:// for URLs on blur to prevent HTML5 validation error
    const demoInput = document.getElementById('proj-demo');
    const repoInput = document.getElementById('proj-repo');

    [demoInput, repoInput].forEach(input => {
      input.addEventListener('blur', () => {
        let val = input.value.trim();
        if (val && !/^https?:\/\//i.test(val)) {
          input.value = 'https://' + val;
        }
      });
    });

    // Handle Edit & Delete via Event Delegation
    projectsGrid.addEventListener('click', (e) => {
      // 폴더 열기 / 나가기
      const tile = e.target.closest('.folder-tile');
      if (tile) { currentFolder = tile.dataset.folder; render(); return; }
      if (e.target.closest('.folder-back')) { currentFolder = null; render(); return; }

      const layoutBtn = e.target.closest('.layout-btn');
      if (layoutBtn) {
        currentLayout = layoutBtn.dataset.layout;
        localStorage.setItem('vibe_layout', currentLayout);
        render();
        return;
      }

      const btnEdit = e.target.closest('.btn-edit');
      const btnDelete = e.target.closest('.btn-delete');

      if (btnEdit) {
        const id = parseInt(btnEdit.dataset.id);
        openEditModal(id);
      } else if (btnDelete) {
        const id = parseInt(btnDelete.dataset.id);
        deleteProject(id);
      }
    });

    // Populate modal with project details for editing
    function openEditModal(id) {
      const project = projects.find(p => p.id === id);
      if (!project) return;

      // Populate input values
      document.getElementById('proj-id').value = project.id;
      document.getElementById('proj-title').value = project.title;
      document.getElementById('proj-status').value = project.status;
      document.getElementById('proj-category').value = project.category;
      document.getElementById('proj-description').value = project.description;
      document.getElementById('proj-tech').value = project.techStack.join(', ');
      document.getElementById('proj-ai').value = project.aiTools || '';
      document.getElementById('proj-prompt').value = project.promptSummary || '';
      document.getElementById('proj-demo').value = project.demoUrl || '';
      document.getElementById('proj-repo').value = project.repoUrl || '';

      // UI Text dynamic change
      document.querySelector('.modal-header h2').innerHTML = '<i data-lucide="edit-3"></i> 프로젝트 정보 수정';
      document.querySelector('#project-form button[type="submit"]').textContent = '수정 완료';
      
      // Update icons inside header
      lucide.createIcons();

      // Show modal
      projectModal.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      // Update tech chips visual status
      setTimeout(updateChipHighlights, 50);
    }

    // Delete project with confirm check (Hybrid: Local vs Google Sheets API)
    async function deleteProject(id) {
      const project = projects.find(p => p.id === id);
      if (!project) return;

      if (!confirm(`정말 "${project.title}" 프로젝트를 삭제하시겠습니까?`)) {
        return;
      }

      const sheetApiUrl = getSheetApiUrl();

      if (sheetApiUrl) {
        showToast('구글 시트에서 삭제하는 중...');
        const payload = {
          action: 'delete',
          data: { id: id }
        };

        try {
          const response = await fetch(sheetApiUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' },
            redirect: 'follow'
          });

          if (response.ok) {
            const resData = await response.json();
            if (resData.status === 'success') {
              projects = projects.filter(p => p.id !== id);
              saveToLocalStorage();
              render();
              showToast('프로젝트가 삭제되었습니다.');
            } else {
              showToast('구글 시트 삭제 실패: ' + resData.message);
            }
          } else {
            showToast('연동 서버 삭제 처리 중 오류가 발생했습니다.');
          }
        } catch (err) {
          console.error('GAS Delete error:', err);
          showToast('네트워크 오류: 구글 시트에서 삭제하지 못했습니다.');
        }
      } else {
        projects = projects.filter(p => p.id !== id);
        saveToLocalStorage();
        render();
        showToast('프로젝트가 삭제되었습니다.');
      }
    }

    // Update chip styling based on text input
    function updateChipHighlights() {
      const currentTechs = projTechInput.value
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      stackChips.forEach(chip => {
        const val = chip.dataset.value.toLowerCase();
        if (currentTechs.includes(val)) {
          chip.classList.add('selected');
        } else {
          chip.classList.remove('selected');
        }
      });
    }

    // Toggle tech chips
    stackChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.value;
        let currentTechs = projTechInput.value
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0);

        const index = currentTechs.findIndex(t => t.toLowerCase() === val.toLowerCase());
        if (index > -1) {
          // Remove if already exists
          currentTechs.splice(index, 1);
        } else {
          // Add if not exists
          currentTechs.push(val);
        }

        projTechInput.value = currentTechs.join(', ');
        updateChipHighlights();

        // Auto detect and select category
        const recommendedCategory = autoDetectCategory(currentTechs, document.getElementById('proj-demo').value || document.getElementById('proj-repo').value);
        if (recommendedCategory) {
          document.getElementById('proj-category').value = recommendedCategory;
        }
      });
    });

    // Real-time chip sync and auto category selection when user types manually
    projTechInput.addEventListener('input', () => {
      updateChipHighlights();

      const currentTechs = projTechInput.value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const recommendedCategory = autoDetectCategory(currentTechs, document.getElementById('proj-demo').value || document.getElementById('proj-repo').value);
      if (recommendedCategory) {
        document.getElementById('proj-category').value = recommendedCategory;
      }
    });

    // Sync highlights when modal opens or resets
    btnOpenModal.addEventListener('click', () => {
      setTimeout(updateChipHighlights, 50); // Small delay to let input render
    });

    // 카테고리는 이제 "용도"라 기술 스택으로 자동 추정할 수 없다.
    // 사용자가 드롭다운에서 직접 고르도록 자동 지정을 끈다(항상 null).
    function autoDetectCategory() {
      return null;
    }

    // Demo URL analysis (Pattern matching)
    btnAnalyzeDemo.addEventListener('click', () => {
      const url = document.getElementById('proj-demo').value.trim();
      if (!url) {
        showToast('먼저 데모 링크 URL을 입력해 주세요.');
        return;
      }

      const detected = [];
      const urlLower = url.toLowerCase();

      if (urlLower.includes('script.google.com')) {
        detected.push('Google Apps Script', 'JavaScript');
      }
      if (urlLower.includes('github.io') || urlLower.includes('netlify.app') || urlLower.includes('vercel.app')) {
        detected.push('HTML', 'CSS', 'JavaScript');
      }
      if (urlLower.includes('streamlit.app')) {
        detected.push('Python', 'Streamlit');
      }

      if (detected.length > 0) {
        // Merge with existing tech stack
        let currentTechs = projTechInput.value
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0);

        detected.forEach(tech => {
          if (!currentTechs.some(t => t.toLowerCase() === tech.toLowerCase())) {
            currentTechs.push(tech);
          }
        });

        projTechInput.value = currentTechs.join(', ');
        updateChipHighlights();

        // Auto detect and select category
        const recommendedCategory = autoDetectCategory(currentTechs, url);
        if (recommendedCategory) {
          document.getElementById('proj-category').value = recommendedCategory;
          showToast(`기술 감지 완료: ${detected.join(', ')} / 카테고리 자동 설정: [${recommendedCategory}]`);
        } else {
          showToast(`주소 패턴에서 기술 감지 완료: ${detected.join(', ')}`);
        }
      } else {
        showToast('해당 주소에서 감지된 패턴이 없습니다. 추천 칩에서 직접 선택해 보세요!');
      }
    });

    // Repository URL analysis (GitHub API)
    btnAnalyzeRepo.addEventListener('click', async () => {
      const url = document.getElementById('proj-repo').value.trim();
      if (!url) {
        showToast('먼저 저장소 URL을 입력해 주세요.');
        return;
      }

      if (!url.toLowerCase().includes('github.com')) {
        showToast('GitHub 레포지토리 주소만 자동 분석을 지원합니다.');
        return;
      }

      // Regex to extract owner and repo
      const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
      if (!match) {
        showToast('올바른 GitHub 저장소 형식이 아닙니다. (예: github.com/user/repo)');
        return;
      }

      const owner = match[1];
      const repo = match[2];

      btnAnalyzeRepo.disabled = true;
      const originalText = btnAnalyzeRepo.textContent;
      btnAnalyzeRepo.textContent = '분석 중...';

      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`);
        if (response.ok) {
          const data = await response.json();
          const detectedLanguages = Object.keys(data); // e.g. ["JavaScript", "HTML", "CSS"]

          if (detectedLanguages.length > 0) {
            let currentTechs = projTechInput.value
              .split(',')
              .map(t => t.trim())
              .filter(t => t.length > 0);

            detectedLanguages.forEach(tech => {
              if (!currentTechs.some(t => t.toLowerCase() === tech.toLowerCase())) {
                currentTechs.push(tech);
              }
            });

            projTechInput.value = currentTechs.join(', ');
            updateChipHighlights();

            // Auto detect and select category
            const recommendedCategory = autoDetectCategory(currentTechs, url);
            if (recommendedCategory) {
              document.getElementById('proj-category').value = recommendedCategory;
              showToast(`GitHub 언어 감지 완료: ${detectedLanguages.join(', ')} / 카테고리 자동 설정: [${recommendedCategory}]`);
            } else {
              showToast(`GitHub에서 기술 감지 완료: ${detectedLanguages.join(', ')}`);
            }
          } else {
            showToast('저장소에 등록된 프로그래밍 코드가 없습니다.');
          }
        } else {
          showToast('저장소 분석 실패: 존재하지 않는 레포지토리이거나 제한을 초과했습니다.');
        }
      } catch (err) {
        console.error('GitHub API error:', err);
        showToast('네트워크 오류: API 호출에 실패했습니다.');
      } finally {
        btnAnalyzeRepo.disabled = false;
        btnAnalyzeRepo.textContent = originalText;
      }
    });

    // Copy JSON schema to clipboard
    btnCopyJson.addEventListener('click', () => {
      const jsonString = JSON.stringify(projects, null, 2);
      navigator.clipboard.writeText(jsonString)
        .then(() => showToast('클립보드에 JSON 데이터 복사 완료!'))
        .catch(err => {
          console.error('Copy failed', err);
          showToast('복사에 실패했습니다. 개발자 도구 콘솔을 확인하세요.');
        });
    });

    // Download JSON as file
    btnDownloadJson.addEventListener('click', () => {
      const jsonString = JSON.stringify(projects, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'projects.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('projects.json 파일 다운로드 시작!');
    });

    // --- Google Sheets Settings Modal Controls ---
    btnOpenSettings.addEventListener('click', () => {
      let savedApiUrl = localStorage.getItem('sheet_api_url') || '';
      if (savedApiUrl === 'none') savedApiUrl = '';
      settingsApiUrlInput.value = savedApiUrl;
      settingsModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    const closeSettingsModal = () => {
      settingsModal.classList.remove('active');
      document.body.style.overflow = '';
    };

    btnCloseSettings.addEventListener('click', closeSettingsModal);
    btnCancelSettings.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });

    // Save Settings
    btnSaveSettings.addEventListener('click', async () => {
      const url = settingsApiUrlInput.value.trim();
      if (!url) {
        showToast('API URL을 입력하거나 연동 해제를 선택하세요.');
        return;
      }

      if (!url.startsWith('https://script.google.com/')) {
        showToast('올바른 Google Apps Script Web App URL이 아닙니다.');
        return;
      }

      localStorage.setItem('sheet_api_url', url);
      updateSyncIndicator();
      closeSettingsModal();
      showToast('구글 시트 API 연동이 설정되었습니다!');
      
      // Reload projects from sheets
      await fetchFromGoogleSheets(url);
    });

    // Clear Settings
    btnClearSettings.addEventListener('click', () => {
      if (confirm('구글 시트 연동을 해제하고 로컬 모드로 전환하시겠습니까?')) {
        localStorage.setItem('sheet_api_url', 'none');
        settingsApiUrlInput.value = '';
        updateSyncIndicator();
        closeSettingsModal();
        showToast('연동이 해제되었습니다. 로컬 데이터를 불러옵니다.');
        
        // Reload from local fallback
        loadLocalFallback();
      }
    });

    // Copy Sync sharing link
    btnShareSettings.addEventListener('click', () => {
      const sheetApiUrl = getSheetApiUrl();
      if (!sheetApiUrl) {
        showToast('구글 시트 연동 설정을 먼저 완료해 주세요.');
        return;
      }

      const baseUrl = window.location.href.split('?')[0].split('#')[0];
      const shareUrl = `${baseUrl}?api=${encodeURIComponent(sheetApiUrl)}`;

      navigator.clipboard.writeText(shareUrl)
        .then(() => showToast('공유용 연동 주소 링크가 복사되었습니다!'))
        .catch(err => {
          console.error('Failed to copy link', err);
          showToast('링크 복사에 실패했습니다.');
        });
    });
  }

  // Trigger init
  init();
});
// 관리자 권한 확인 및 일반 사용자 화면 제어 로직
document.addEventListener("DOMContentLoaded", function () {
  // 1. 관리자 여부를 판별합니다.
  //    이 핸들러는 init()보다 나중에 등록되어 나중에 실행되는데, init()은 그 사이에
  //    replaceState로 주소창의 ?api=를 이미 지워버립니다. 따라서 주소창을 보면 항상
  //    비어 있고, init()이 localStorage에 저장해 둔 값으로 판별해야 합니다.
  //    방문자는 ?api=로 들어온 적이 없으므로 이 값이 없습니다.
  const isAdmin = localStorage.getItem('sheet_api_url') !== null;

  // 카드 안의 수정·삭제 버튼은 렌더링 때마다 새로 생기므로 개별 요소가 아니라
  // body 클래스로 제어합니다 (CSS에서 body.is-admin일 때만 표시).
  document.body.classList.toggle('is-admin', isAdmin);

  // 2. 제어할 HTML 요소(버튼 및 배너)들을 가져옵니다.
  const btnOpenModal = document.getElementById("btn-open-modal");       // "새 프로젝트 추가" 버튼
  const btnOpenSettings = document.getElementById("btn-open-settings"); // "설정" 톱니바퀴 버튼
  const appFooter = document.querySelector(".app-footer");             // "로컬 파일 동기화" 푸터 배너

  // 3. 일반 방문자라면 관리자 기능들을 숨깁니다.
  if (!isAdmin) {
    if (btnOpenModal) btnOpenModal.style.display = "none";
    if (btnOpenSettings) btnOpenSettings.style.display = "none";
    if (appFooter) appFooter.style.display = "none";
    
    // (선택 사항) 로컬 단독 모드 표시등을 숨기거나 일반 사용자용 텍스트로 바꿀 수도 있습니다.
    const syncIndicator = document.getElementById("sync-indicator");
    if (syncIndicator) {
      syncIndicator.style.display = "none"; // 로컬 단독 모드 표시등도 깔끔하게 숨깁니다.
    }
  }
});
