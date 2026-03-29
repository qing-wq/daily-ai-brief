const REPO_OWNER = 'qing-wq';
const REPO_NAME = 'daily-ai-brief';
const DIGESTS_PATH = 'digests';

function getTodayDate() {
  const now = new Date();
  return formatDate(now);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr) {
  const date = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  return date.toLocaleDateString('zh-CN', options);
}

function parseDigest(text) {
  const lines = text.split('\n');
  let html = '';
  let currentBuilder = null;
  let inContent = false;
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
    if (!l || l.startsWith('---') || l.startsWith('Generated')) continue;
    
    const builderMatch = l.match(/^\*\*(.+?)\*\*\s*[-–]\s*(.+)$/);
    if (builderMatch) {
      if (currentBuilder && contentLines.length > 0) {
        html += `<div class="builder-content">${contentLines.join('')}</div></div></div>`;
      }
      currentBuilder = builderMatch[1];
      const role = builderMatch[2];
      const initials = nameMap[currentBuilder] || currentBuilder.substring(0, 2).toUpperCase();
      html += `<div class="builder-card"><div class="builder-header"><div class="builder-avatar">${initials}</div><div class="builder-info"><div class="builder-name">${currentBuilder}</div><div class="builder-role">${role}</div></div></div><div class="builder-content">`;
      contentLines = [];
      inContent = true;
      continue;
    }
    
    const linkMatch = l.match(/^(https?:\/\/[^\s]+)$/);
    if (linkMatch && inContent) {
      contentLines.push(`<a href="${linkMatch[1]}" class="builder-link" target="_blank">↗ 查看原文</a>`);
      continue;
    }
    
    if (inContent && l) {
      let processedLine = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      contentLines.push(`<p>${processedLine}</p>`);
    }
  }
  
  if (currentBuilder && contentLines.length > 0) {
    html += contentLines.join('') + '</div></div></div>';
  }

  const statsMatch = text.match(/(\d+)\s*位 builders.*?(\d+)\s*条推文/);
  if (statsMatch) {
    html += `<div class="stats"><div class="stat"><div class="stat-value">${statsMatch[1]}</div><div class="stat-label">Builders</div></div><div class="stat"><div class="stat-value">${statsMatch[2]}</div><div class="stat-label">推文</div></div></div>`;
  }

  return html || '<p class="loading">暂无内容</p>';
}

async function loadTodayDigest() {
  const today = getTodayDate();
  const dateEl = document.getElementById('today-date');
  const contentEl = document.getElementById('today-content');
  dateEl.textContent = formatDisplayDate(today);
  
  try {
    // Use download_url for raw content (avoids CORS issues)
    const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/master/${DIGESTS_PATH}/${today}.md`;
    const response = await fetch(url);
    if (response.ok) {
      const content = await response.text();
      contentEl.innerHTML = parseDigest(content);
    } else {
      contentEl.innerHTML = '<div class="loading"><p>今日简报尚未生成</p><p style="font-size: 13px; margin-top: 8px;">将在每天 10:30 自动更新</p></div>';
    }
  } catch (error) {
    contentEl.innerHTML = '<div class="loading"><p>加载失败</p><p style="font-size: 13px; margin-top: 8px;">请稍后重试</p></div>';
  }
}

async function loadArchive() {
  const listEl = document.getElementById('archive-list');
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DIGESTS_PATH}`;
    const response = await fetch(url);
    if (response.ok) {
      const files = await response.json();
      const digests = files.filter(f => f.name.endsWith('.md')).map(f => f.name.replace('.md', '')).sort((a, b) => b.localeCompare(a));
      if (digests.length === 0) { listEl.innerHTML = '<p class="loading">暂无历史记录</p>'; return; }
      listEl.innerHTML = digests.map(date => `<a href="#" class="archive-item" data-date="${date}"><span class="archive-date">${formatDisplayDate(date)}</span><span class="archive-arrow">→</span></a>`).join('');
      listEl.querySelectorAll('.archive-item').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); showDigest(item.dataset.date); });
      });
    } else { listEl.innerHTML = '<p class="loading">加载失败</p>'; }
  } catch (error) { listEl.innerHTML = '<p class="loading">加载失败</p>'; }
}

async function showDigest(date) {
  const todayView = document.getElementById('today-view');
  const archiveView = document.getElementById('archive-view');
  const contentEl = document.getElementById('today-content');
  const dateEl = document.getElementById('today-date');
  
  archiveView.classList.remove('active');
  todayView.classList.add('active');
  dateEl.textContent = formatDisplayDate(date);
  contentEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>加载中...</p></div>';
  
  try {
    // Use raw.githubusercontent.com for direct content access
    const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/master/${DIGESTS_PATH}/${date}.md`;
    const response = await fetch(url);
    if (response.ok) {
      const content = await response.text();
      contentEl.innerHTML = parseDigest(content);
    } else { contentEl.innerHTML = '<p class="loading">内容加载失败</p>'; }
  } catch (error) { contentEl.innerHTML = '<p class="loading">加载失败</p>'; }
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

document.addEventListener('DOMContentLoaded', () => { setupNavigation(); loadTodayDigest(); });
