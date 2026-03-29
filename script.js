const REPO_OWNER = 'qing-wq';
const REPO_NAME = 'daily-ai-brief';
const DIGESTS_PATH = 'digests';

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  return date.toLocaleDateString('zh-CN', options);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function parseDigest(text) {
  if (!text || text.trim() === '') {
    return '<p class="loading">暂无内容</p>';
  }
  
  const lines = text.split('\n');
  let html = '';
  let currentBuilder = null;
  let contentLines = [];
  
  const nameMap = {
    'Andrej Karpathy': 'AK', 'Swyx': 'SX', 'Amjad Masad': 'AM',
    'Peter Steinberger': 'PS', 'Garry Tan': 'GT', 'Zara Zhang': 'ZZ',
    'Guillermo Rauch': 'GR', 'Peter Yang': 'PY', 'Nan Yu': 'NY',
    'Josh Woodward': 'JW', 'Aaron Levie': 'AL', 'Dan Shipper': 'DS',
    'Nikunj Kothari': 'NK'
  };

  for (const line of lines) {
    const l = line.trim();
    
    // Skip empty lines, separators, and footer
    if (!l || l.startsWith('---') || l.startsWith('Generated') || l.startsWith('*本期')) continue;
    
    // Builder section header (支持 hyphen-, en dash–, em dash—)
    const builderMatch = l.match(/^\*\*(.+?)\*\*\s*[-–—]\s*(.+)$/);
    if (builderMatch) {
      // Close previous builder
      if (currentBuilder && contentLines.length > 0) {
        html += '<div class="builder-content">' + contentLines.join('') + '</div></div></div>';
      }
      currentBuilder = builderMatch[1];
      const role = builderMatch[2];
      const initials = nameMap[currentBuilder] || currentBuilder.substring(0, 2).toUpperCase();
      html += `<div class="builder-card"><div class="builder-header"><div class="builder-avatar">${escapeHtml(initials)}</div><div class="builder-info"><div class="builder-name">${escapeHtml(currentBuilder)}</div><div class="builder-role">${escapeHtml(role)}</div></div></div><div class="builder-content">`;
      contentLines = [];
      continue;
    }
    
    // Tweet/post link
    const linkMatch = l.match(/^(https?:\/\/[^\s]+)$/);
    if (linkMatch && currentBuilder) {
      contentLines.push(`<a href="${escapeHtml(linkMatch[1])}" class="builder-link" target="_blank" rel="noopener noreferrer">↗ 查看原文</a>`);
      continue;
    }
    
    // Regular content
    if (currentBuilder && l) {
      // Skip section headers
      if (l.startsWith('## ') || l.startsWith('# ')) continue;
      // Handle bold text - simple markdown processing without breaking HTML
      let processed = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      contentLines.push('<p>' + processed + '</p>');
    }
  }
  
  // Close last builder
  if (currentBuilder && contentLines.length > 0) {
    html += contentLines.join('') + '</div></div></div>';
  }

  // Parse stats
  const statsMatch = text.match(/(\d+)\s*位 builders.*?(\d+)\s*条推文/);
  if (statsMatch) {
    html += '<div class="stats"><div class="stat"><div class="stat-value">' + statsMatch[1] + '</div><div class="stat-label">Builders</div></div><div class="stat"><div class="stat-value">' + statsMatch[2] + '</div><div class="stat-label">推文</div></div></div>';
  }

  return html || '<p class="loading">解析失败</p>';
}

async function loadContent(url) {
  // Try direct fetch first (works if CSP allows it)
  try {
    const response = await fetch(url);
    if (response.ok) return await response.text();
  } catch (e) {}
  
  // Fallback: use CORS proxy
  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.text();
  } catch (e) {}
  
  return null;
}

async function loadTodayDigest() {
  const today = getTodayDate();
  document.getElementById('today-date').textContent = formatDate(today);
  
  const contentEl = document.getElementById('today-content');
  contentEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>加载中...</p></div>';
  
  // Try raw content first
  let content = await loadContent(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/master/${DIGESTS_PATH}/${today}.md`);
  
  // If that fails, try GitHub API
  if (!content) {
    try {
      const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DIGESTS_PATH}/${today}.md`;
      const response = await fetch(apiUrl, { mode: 'cors' });
      if (response.ok) {
        const data = await response.json();
        content = atob(data.content);
      }
    } catch (e) {
      console.error('API error:', e);
    }
  }
  
  if (content) {
    contentEl.innerHTML = parseDigest(content);
  } else {
    contentEl.innerHTML = '<div class="loading"><p>今日简报尚未生成</p><p style="font-size: 13px; margin-top: 8px;">将在每天 10:30 自动更新</p></div>';
  }
}

async function loadArchive() {
  const listEl = document.getElementById('archive-list');
  listEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>加载中...</p></div>';
  
  try {
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DIGESTS_PATH}`;
    let response = await fetch(apiUrl).catch(() => null);
    if (!response || !response.ok) {
      response = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(apiUrl));
    }
    
    if (!response || !response.ok) {
      listEl.innerHTML = '<p class="loading">加载失败</p>';
      return;
    }
    
    const files = await response.json();
    const digests = files
      .filter(f => f.name.endsWith('.md'))
      .map(f => f.name.replace('.md', ''))
      .sort((a, b) => b.localeCompare(a));
    
    if (digests.length === 0) {
      listEl.innerHTML = '<p class="loading">暂无历史记录</p>';
      return;
    }
    
    listEl.innerHTML = digests.map(date => 
      `<a href="#" class="archive-item" data-date="${date}">
        <span class="archive-date">${formatDate(date)}</span>
        <span class="archive-arrow">→</span>
      </a>`
    ).join('');
    
    listEl.querySelectorAll('.archive-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        showDigest(item.dataset.date);
      });
    });
  } catch (e) {
    console.error('Archive error:', e);
    listEl.innerHTML = '<p class="loading">加载失败</p>';
  }
}

async function showDigest(date) {
  const todayView = document.getElementById('today-view');
  const archiveView = document.getElementById('archive-view');
  const contentEl = document.getElementById('today-content');
  
  archiveView.classList.remove('active');
  todayView.classList.add('active');
  document.getElementById('today-date').textContent = formatDate(date);
  contentEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>加载中...</p></div>';
  
  let content = await loadContent(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/master/${DIGESTS_PATH}/${date}.md`);
  
  if (!content) {
    try {
      const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DIGESTS_PATH}/${date}.md`;
      const response = await fetch(apiUrl, { mode: 'cors' });
      if (response.ok) {
        const data = await response.json();
        content = atob(data.content);
      }
    } catch (e) {}
  }
  
  if (content) {
    contentEl.innerHTML = parseDigest(content);
  } else {
    contentEl.innerHTML = '<p class="loading">内容加载失败</p>';
  }
}

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      document.getElementById('today-view').classList.toggle('active', view === 'today');
      document.getElementById('archive-view').classList.toggle('active', view === 'archive');
      if (view === 'archive') loadArchive();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  
  // Try to load embedded digest first (from build.js)
  if (window.DIGEST_CONTENT) {
    try {
      document.getElementById('today-content').innerHTML = parseDigest(window.DIGEST_CONTENT);
      return;
    } catch (e) {}
  }
  
  // Fallback to fetch if no embedded data
  loadTodayDigest();
});
