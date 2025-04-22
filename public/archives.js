// archives.js - Handles the archived leaderboards functionality

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const currentViewBtn = document.getElementById('current-view-btn');
  const archivesViewBtn = document.getElementById('archives-view-btn');
  const currentView = document.getElementById('current-view');
  const archivesView = document.getElementById('archives-view');
  const weekSelect = document.getElementById('week-select');
  const startDateInput = document.getElementById('start-date');
  const endDateInput = document.getElementById('end-date');
  const searchArchivesBtn = document.getElementById('search-archives-btn');
  const archiveResults = document.getElementById('archive-results');

  // View toggle functionality
  currentViewBtn.addEventListener('click', () => {
    currentViewBtn.classList.add('active');
    archivesViewBtn.classList.remove('active');
    currentView.classList.remove('hidden');
    archivesView.classList.add('hidden');
  });

  archivesViewBtn.addEventListener('click', () => {
    archivesViewBtn.classList.add('active');
    currentViewBtn.classList.remove('active');
    archivesView.classList.remove('hidden');
    currentView.classList.add('hidden');
    
    // Load archived weeks when switching to archives view
    loadArchivedWeeks();
  });

  // Load archived weeks for the dropdown
  async function loadArchivedWeeks() {
    try {
      const response = await fetch('/api/archives/weeks');
      if (!response.ok) throw new Error('Failed to fetch archived weeks');
      
      const weeks = await response.json();
      
      // Clear previous options except the default one
      weekSelect.innerHTML = '<option value="">Select a week...</option>';
      
      if (weeks.length === 0) {
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = 'No archives available';
        weekSelect.appendChild(option);
      } else {
        weeks.forEach(weekId => {
          const option = document.createElement('option');
          option.value = weekId;
          option.textContent = weekId;
          weekSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading archived weeks:', error);
      archiveResults.innerHTML = `<p class="error">Error loading archived weeks: ${error.message}</p>`;
    }
  }

  // Load archived data for a specific week
  async function loadArchivedWeek(weekId) {
    try {
      const response = await fetch(`/api/archives/week/${weekId}`);
      if (!response.ok) throw new Error('Failed to fetch archived data');
      
      const archive = await response.json();
      displayArchivedData(archive);
    } catch (error) {
      console.error('Error loading archived week:', error);
      archiveResults.innerHTML = `<p class="error">Error loading archived data: ${error.message}</p>`;
    }
  }

  // Load archived data for a date range
  async function loadArchivedRange(startDate, endDate) {
    try {
      const response = await fetch(`/api/archives/range?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) throw new Error('Failed to fetch archived data');
      
      const archives = await response.json();
      
      if (archives.length === 0) {
        archiveResults.innerHTML = '<p class="no-archives">No archives found for the specified date range</p>';
        return;
      }
      
      // Display the first archive in the range
      displayArchivedData(archives[0], archives.length > 1 ? archives.length : null);
    } catch (error) {
      console.error('Error loading archived range:', error);
      archiveResults.innerHTML = `<p class="error">Error loading archived data: ${error.message}</p>`;
    }
  }

  // Display archived data
  function displayArchivedData(archive, totalArchives = null) {
    // Create archive info section
    let html = `
      <div class="archive-week-info">
        <p><strong>Week ID:</strong> ${archive.weekId}</p>
        <p><strong>Period:</strong> ${archive.startDate} to ${archive.endDate}</p>
        <p><strong>Archived:</strong> ${new Date(archive.archivedAt).toLocaleString()}</p>
        ${totalArchives ? `<p><strong>Note:</strong> Showing 1 of ${totalArchives} archives in the selected range</p>` : ''}
      </div>
    `;

    // Create sections for each category
    const categories = [
      { key: "6gb", label: "6GB VRAM" },
      { key: "12gb", label: "12GB VRAM" },
      { key: "16gb", label: "16GB VRAM" },
      { key: "24gb", label: "24GB VRAM" },
      { key: "48gb", label: "48GB VRAM" },
      { key: "72gb", label: "72GB VRAM" },
      { key: "96gb", label: "96GB VRAM" }
    ];

    categories.forEach(category => {
      const entries = archive.data[category.key] || [];
      
      if (entries.length === 0) return; // Skip empty categories
      
      const sortedEntries = [...entries].sort((a, b) => b.votes - a.votes);
      const totalVotes = sortedEntries.reduce((sum, entry) => sum + entry.votes, 0);
      
      html += `<div class="archive-category">
        <h3>${category.label}</h3>
        <div class="archive-entries">`;
      
      sortedEntries.forEach((entry, index) => {
        const percentage = totalVotes > 0 ? Math.round((entry.votes / totalVotes) * 100) : 0;
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        
        html += `
          <div class="poll-item">
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
            </div>
          </div>
        `;
      });
      
      html += `</div></div>`;
    });
    
    archiveResults.innerHTML = html;
  }

  // Format number helper (same as in script.js)
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Event listeners
  weekSelect.addEventListener('change', () => {
    const weekId = weekSelect.value;
    if (weekId) {
      loadArchivedWeek(weekId);
    } else {
      archiveResults.innerHTML = '<p class="no-archives">Select a week or date range to view archived leaderboards</p>';
    }
  });

  searchArchivesBtn.addEventListener('click', () => {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before end date');
      return;
    }
    
    loadArchivedRange(startDate, endDate);
  });
});