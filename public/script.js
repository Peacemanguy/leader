// ---- VRAM categories ----
const CATEGORIES = [
  { key: "6gb", label: "6GB VRAM" },
  { key: "12gb", label: "12GB VRAM" },
  { key: "16gb", label: "16GB VRAM" },
  { key: "24gb", label: "24GB VRAM" },
  { key: "48gb", label: "48GB VRAM" },
  { key: "72gb", label: "72GB VRAM" },
  { key: "96gb", label: "96GB VRAM" }
];

// ---- State management ----
const state = {
  activeCategory: CATEGORIES[0].key,
  sortOption: 'votes', // 'votes', 'newest', 'oldest'
  data: {},
  lastVotedIds: {},
  refreshInterval: null,
  pollInterval: 10000, // 10 seconds
};

// ---- helpers ----
async function api(url, data) {
  const opts = data ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  } : {};
  const res = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Server error');
  return json;
}

function calculatePercentage(votes, totalVotes) {
  if (totalVotes === 0) return 0;
  return Math.round((votes / totalVotes) * 100);
}

function getTotalVotes(entries) {
  return entries.reduce((sum, entry) => sum + entry.votes, 0);
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function sortEntries(entries, sortOption) {
  const entriesCopy = [...entries];
  
  if (sortOption === 'votes') {
    return entriesCopy.sort((a, b) => {
      // First sort by votes (descending)
      const votesDiff = b.votes - a.votes;
      if (votesDiff !== 0) return votesDiff;
      
      // If votes are equal, sort by id (newest first)
      return parseInt(b.id) - parseInt(a.id);
    });
  } else if (sortOption === 'newest') {
    return entriesCopy.sort((a, b) => parseInt(b.id) - parseInt(a.id));
  } else if (sortOption === 'oldest') {
    return entriesCopy.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  }
  
  // Default to votes sorting
  return entriesCopy.sort((a, b) => b.votes - a.votes);
}

// ---- rendering ----
function createCategoryTabs() {
  const tabsContainer = document.getElementById('category-tabs');
  tabsContainer.innerHTML = '';
  
  CATEGORIES.forEach(category => {
    const tab = document.createElement('div');
    tab.className = `tab ${category.key === state.activeCategory ? 'active' : ''}`;
    tab.setAttribute('data-category', category.key);
    tab.textContent = category.label;
    tabsContainer.appendChild(tab);
  });
}

function createLeaderboardSection(category) {
  const section = document.createElement('section');
  section.className = `leaderboard-section ${category.key === state.activeCategory ? 'active' : ''}`;
  section.id = `section-${category.key}`;
  
  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">${category.label} Leaderboard</h2>
      <div class="sort-options">
        <button class="sort-option ${state.sortOption === 'votes' ? 'active' : ''}" data-sort="votes">Most Votes</button>
        <button class="sort-option ${state.sortOption === 'newest' ? 'active' : ''}" data-sort="newest">Newest</button>
        <button class="sort-option ${state.sortOption === 'oldest' ? 'active' : ''}" data-sort="oldest">Oldest</button>
      </div>
    </div>
    
    <div class="poll-items" id="poll-items-${category.key}">
      <!-- Poll items will be rendered here -->
    </div>
    
    <div class="add-form-container">
      <form class="add-form" data-category="${category.key}">
        <div class="input-container">
          <input class="add-input" type="text" placeholder="Add a new entry..." required autocomplete="off" />
          <div class="validation-indicator"></div>
          <div class="dropdown-container">
            <div class="dropdown-loading hidden">
              <div class="spinner"></div>
              <span>Loading results...</span>
            </div>
            <ul class="dropdown-results hidden"></ul>
          </div>
        </div>
        <button type="submit" class="add-btn" disabled>Add & Vote</button>
        <span class="error add-error"></span>
      </form>
    </div>
  `;
  
  return section;
}

function renderPollItems(category) {
  const container = document.getElementById(`poll-items-${category}`);
  if (!container) return;
  
  container.innerHTML = '';
  const entries = state.data[category] || [];
  if (entries.length === 0) {
    container.innerHTML = '<p class="no-entries">No entries yet. Be the first to add one!</p>';
    return;
  }
  
  const sortedEntries = sortEntries(entries, state.sortOption);
  const totalVotes = getTotalVotes(sortedEntries);
  
  sortedEntries.forEach((entry, index) => {
    const percentage = calculatePercentage(entry.votes, totalVotes);
    const isVoted = state.lastVotedIds[category] === entry.id;
    const rankClass = index < 3 ? `rank-${index + 1}` : '';
    
    const pollItem = document.createElement('div');
    pollItem.className = `poll-item ${isVoted ? 'voted' : ''}`;
    pollItem.setAttribute('data-id', entry.id);
    
    if (state.lastVotedIds[category] === entry.id) {
      pollItem.classList.add('highlight');
      // Remove highlight class after animation completes
      setTimeout(() => {
        pollItem.classList.remove('highlight');
      }, 1000);
    }
    
    pollItem.innerHTML = `
      <div class="poll-item-header">
        <div class="poll-item-name">
          ${rankClass ? `<span class="rank ${rankClass}">${index + 1}</span>` : `<span class="rank">${index + 1}</span>`}
          ${entry.name}
        </div>
        <div class="poll-item-votes">${formatNumber(entry.votes)} votes</div>
      </div>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${percentage}%"></div>
      </div>
      <div class="poll-item-footer">
        <span class="vote-percentage">${percentage}%</span>
        <button class="vote-btn ${isVoted ? 'voted' : ''}"
                data-id="${entry.id}"
                data-category="${category}"
                ${isVoted ? 'disabled' : ''}>
          ${isVoted ? 'Voted' : 'Vote'}
        </button>
      </div>
    `;
    
    container.appendChild(pollItem);
  });
}

async function refreshData(category, highlightChanges = false) {
  try {
    const entries = await api(`/api/entries?category=${category}`);
    
    // Store previous data for comparison if highlighting changes
    const prevEntries = state.data[category] || [];
    
    // Update state
    state.data[category] = entries;
    
    // Render the updated data
    renderPollItems(category);
    
    // Highlight changes if needed
    if (highlightChanges && prevEntries.length > 0) {
      entries.forEach(entry => {
        const prevEntry = prevEntries.find(e => e.id === entry.id);
        if (prevEntry && prevEntry.votes !== entry.votes) {
          const pollItem = document.querySelector(`.poll-item[data-id="${entry.id}"]`);
          if (pollItem) {
            pollItem.classList.add('highlight');
            setTimeout(() => {
              pollItem.classList.remove('highlight');
            }, 1000);
          }
        }
      });
    }
  } catch (err) {
    console.error(`Error refreshing ${category}:`, err);
  }
}

function setupPolling() {
  // Clear any existing interval
  if (state.refreshInterval) {
    clearInterval(state.refreshInterval);
  }
  
  // Set up new polling interval
  state.refreshInterval = setInterval(() => {
    refreshData(state.activeCategory, true);
  }, state.pollInterval);
}

// ---- event handlers ----
function handleCategoryChange(category) {
  // Update active category
  state.activeCategory = category;
  
  // Update UI
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-category') === category);
  });
  
  document.querySelectorAll('.leaderboard-section').forEach(section => {
    section.classList.toggle('active', section.id === `section-${category}`);
  });
  
  // Refresh data for the new category
  refreshData(category);
}

function handleSortChange(sortOption) {
  // Update sort option
  state.sortOption = sortOption;
  
  // Update UI
  document.querySelectorAll('.sort-option').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-sort') === sortOption) {
      btn.classList.add('active');
    }
  });
  
  // Re-render with new sort
  refreshData(state.activeCategory, false).then(() => {
    renderPollItems(state.activeCategory);
  });
}

// Hugging Face API validation
let debounceTimer;
let selectedModel = null;

async function validateWithHuggingFace(query) {
  if (!query || query.length < 2) return [];
  
  try {
    // Use our server-side proxy endpoint to avoid CORS issues
    const response = await fetch(`/api/huggingface/models?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch from Hugging Face API');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Hugging Face API error:', error);
    return [];
  }
}

function setupModelValidation(form) {
  const input = form.querySelector('.add-input');
  const dropdownContainer = form.querySelector('.dropdown-container');
  const dropdownResults = form.querySelector('.dropdown-results');
  const dropdownLoading = form.querySelector('.dropdown-loading');
  const submitBtn = form.querySelector('.add-btn');
  const validationIndicator = form.querySelector('.validation-indicator');
  
  input.addEventListener('input', function() {
    const query = this.value.trim();
    selectedModel = null;
    
    // Reset validation state
    validationIndicator.className = 'validation-indicator';
    submitBtn.disabled = true;
    
    // Clear previous results
    dropdownResults.innerHTML = '';
    dropdownResults.classList.add('hidden');
    
    if (query.length < 2) return;
    
    // Show loading indicator
    dropdownLoading.classList.remove('hidden');
    
    // Debounce API calls
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const results = await validateWithHuggingFace(query);
        
        // Hide loading indicator
        dropdownLoading.classList.add('hidden');
        
        if (results.length === 0) {
          dropdownResults.innerHTML = '<li class="no-results">No matching models found</li>';
          dropdownResults.classList.remove('hidden');
          return;
        }
        
        // Populate dropdown with results
        results.forEach(model => {
          const li = document.createElement('li');
          li.className = 'dropdown-item';
          
          // Create a more informative display with model name and author
          const displayName = model.modelId || model.id || model.name;
          const authorInfo = model.author && model.author !== 'Unknown' ? ` by ${model.author}` : '';
          
          li.innerHTML = `
            <div class="dropdown-item-name">${displayName}</div>
            ${authorInfo ? `<div class="dropdown-item-author">${authorInfo}</div>` : ''}
          `;
          
          li.addEventListener('click', () => {
            input.value = displayName;
            selectedModel = model;
            dropdownResults.classList.add('hidden');
            
            // Show validation success
            validationIndicator.className = 'validation-indicator valid';
            submitBtn.disabled = false;
          });
          dropdownResults.appendChild(li);
        });
        
        dropdownResults.classList.remove('hidden');
      } catch (error) {
        console.error('Validation error:', error);
        dropdownLoading.classList.add('hidden');
        
        // Show validation error
        validationIndicator.className = 'validation-indicator invalid';
      }
    }, 300);
  });
  
  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdownContainer.contains(e.target)) {
      dropdownResults.classList.add('hidden');
    }
  });
  
  // Prevent form submission when pressing Enter in the input field
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !selectedModel) {
      e.preventDefault();
    }
  });
}

async function handleAddEntry(form) {
  const category = form.getAttribute('data-category');
  const input = form.querySelector('.add-input');
  const errorSpan = form.querySelector('.error');
  const name = input.value.trim();
  
  errorSpan.textContent = '';
  
  if (!name) {
    errorSpan.textContent = 'Please enter a name';
    return;
  }
  
  if (!selectedModel) {
    errorSpan.textContent = 'Please select a validated model from the dropdown';
    return;
  }
  
  try {
    const entry = await api('/api/add', { name, category });
    input.value = '';
    selectedModel = null;
    
    // Reset validation state
    form.querySelector('.validation-indicator').className = 'validation-indicator';
    form.querySelector('.add-btn').disabled = true;
    
    // Update state
    state.lastVotedIds[category] = entry.id;
    
    // Refresh data
    await refreshData(category);
  } catch (err) {
    errorSpan.textContent = err.message;
  }
}

async function handleVote(btn) {
  const id = btn.getAttribute('data-id');
  const category = btn.getAttribute('data-category');
  
  try {
    await api('/api/vote', { id, category });
    
    // Update state
    state.lastVotedIds[category] = id;
    
    // Refresh data
    await refreshData(category);
  } catch (err) {
    alert(err.message);
  }
}

// ---- main ----
window.addEventListener('DOMContentLoaded', () => {
  const leaderboardsDiv = document.getElementById('leaderboards');
  leaderboardsDiv.innerHTML = '';
  
  // Create category tabs
  createCategoryTabs();
  
  // Render all leaderboard sections
  CATEGORIES.forEach(cat => {
    const section = createLeaderboardSection(cat);
    leaderboardsDiv.appendChild(section);
  });
  
  // Set up model validation for all forms
  document.querySelectorAll('.add-form').forEach(form => {
    setupModelValidation(form);
  });
  
  // Initial data load
  CATEGORIES.forEach(cat => {
    refreshData(cat.key);
  });
  
  // Set up polling for real-time updates
  setupPolling();
  
  // Tab click handler
  document.getElementById('category-tabs').addEventListener('click', e => {
    if (e.target.classList.contains('tab')) {
      const category = e.target.getAttribute('data-category');
      handleCategoryChange(category);
    }
  });
  
  // Sort option click handler
  leaderboardsDiv.addEventListener('click', e => {
    if (e.target.classList.contains('sort-option')) {
      const sortOption = e.target.getAttribute('data-sort');
      if (sortOption && sortOption !== state.sortOption) {
        handleSortChange(sortOption);
      }
    }
  });
  
  // Add entry form handler
  leaderboardsDiv.addEventListener('submit', async e => {
    if (e.target.classList.contains('add-form')) {
      e.preventDefault();
      await handleAddEntry(e.target);
    }
  });
  
  // Vote button handler
  leaderboardsDiv.addEventListener('click', async e => {
    if (e.target.classList.contains('vote-btn') && !e.target.disabled) {
      await handleVote(e.target);
    }
  });
});

// Clean up polling on page unload
window.addEventListener('beforeunload', () => {
  if (state.refreshInterval) {
    clearInterval(state.refreshInterval);
  }
});