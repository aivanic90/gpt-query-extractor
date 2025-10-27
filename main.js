// main.js - Popup script
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("gpt-extractor-button");
  if (button) {
    button.addEventListener("click", extractQueries);
  }

  // Back button event listener
  const backButton = document.getElementById("back-button");
  if (backButton) {
    backButton.addEventListener("click", showInitialView);
  }

  // Retry button event listener
  const retryButton = document.getElementById("retry-button");
  if (retryButton) {
    retryButton.addEventListener("click", showInitialView);
  }

  // Accordion functionality
  initializeAccordions();
});

function initializeAccordions() {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const accordion = header.parentElement;
      const content = accordion.querySelector('.accordion-content');
      const arrow = header.querySelector('.arrow');

      // Toggle current accordion
      content.classList.toggle('expanded');
      arrow.classList.toggle('expanded');

      // Close other accordions
      accordionHeaders.forEach(otherHeader => {
        if (otherHeader !== header) {
          const otherAccordion = otherHeader.parentElement;
          const otherContent = otherAccordion.querySelector('.accordion-content');
          const otherArrow = otherHeader.querySelector('.arrow');
          otherContent.classList.remove('expanded');
          otherArrow.classList.remove('expanded');
        }
      });
    });
  });
}

function showView(viewName) {
  // Hide all views
  document.getElementById('initial-view').style.display = 'none';
  document.getElementById('loading-view').style.display = 'none';
  document.getElementById('results-view').style.display = 'none';
  document.getElementById('error-view').style.display = 'none';

  // Show requested view
  const view = document.getElementById(viewName + '-view');
  view.style.display = 'flex';
  view.style.flexDirection = 'column';
}

function showInitialView() {
  showView('initial');
}

function showLoadingView() {
  showView('loading');
}

function showResultsView() {
  showView('results');
}

function showErrorView(errorMessage) {
  document.getElementById('error-message').textContent = errorMessage;
  showView('error');
}

function displayResults(data) {
  // Update summary
  const summary = document.getElementById('results-summary');
  summary.innerHTML = `
        Found <strong>${data.queries.length}</strong> search queries, 
        <strong>${data.messages.length}</strong> messages,
        <strong>${data.thoughts.length}</strong> thought nodes, and 
        <strong>${data.searchNodes.length}</strong> search nodes.
    `;

  // Update badges
  document.getElementById('messages-badge').textContent = data.messages.length;
  document.getElementById('queries-badge').textContent = data.queries.length;
  document.getElementById('thoughts-badge').textContent = data.thoughts.length;
  document.getElementById('nodes-badge').textContent = data.searchNodes.length;

  // Display messages
  const messagesList = document.getElementById('messages-list');
  messagesList.innerHTML = data.messages.map((message, index) => `
        <div class="message-item ${message.role}">
            <div>
                <span class="role-badge ${message.role}">${message.role}</span>
                <strong>Message ${index + 1}</strong>
            </div>
            <div class="text-content">${escapeHtml(message.text)}</div>
        </div>
    `).join('');

  // Display queries
  const queriesList = document.getElementById('queries-list');
  queriesList.innerHTML = data.queries.map((query, index) => `
        <div class="query-item">
            <strong>Query ${index + 1}</strong>
            <div class="query-text">${escapeHtml(query)}</div>
        </div>
    `).join('');

// Display thoughts
const thoughtsList = document.getElementById('thoughts-list');
thoughtsList.innerHTML = data.thoughts.map((thoughtNode, index) => `
    <div class="thought-item">
        <div>
            <span class="role-badge ${thoughtNode.role}">${thoughtNode.role}</span>
            <strong>Thought Node ${index + 1}</strong>
            <small>(ID: ${thoughtNode.nodeId})</small>
        </div>
        <div class="text-content">
            ${thoughtNode.thoughts.map((thought, tIndex) => `
                <div class="thought-entry">
                    <div class="thought-summary">
                        ${tIndex + 1}. ${escapeHtml(thought.summary || 'No summary')}
                        ${thought.finished ? '<span class="thought-status">Finished</span>' : ''}
                    </div>
                    <div class="thought-content">${escapeHtml(thought.content)}</div>
                </div>
            `).join('')}
        </div>
    </div>
`).join('');

  // Display search nodes
  const nodesList = document.getElementById('nodes-list');
  nodesList.innerHTML = data.searchNodes.map((node, index) => `
        <div class="node-item">
            <div>
                <span class="role-badge ${node.role}">${node.role}</span>
                <strong>Node ${index + 1}</strong>
                <small>(ID: ${node.nodeId})</small>
            </div>
            <div class="text-content">
                <strong>Queries (${node.queries.length}):</strong>
                ${node.queries.map((query, qIndex) => `
                    <div class="query-text">${qIndex + 1}. ${escapeHtml(query)}</div>
                `).join('')}
            </div>
        </div>
    `).join('');

  // Auto-expand the first accordion
  /*const firstAccordion = document.querySelector('.accordion-header');
  if (firstAccordion) {
      firstAccordion.click();
  }*/
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, '<br>');
}

const extractQueries = async () => {
  try {
    console.log("Starting extraction process...");
    showLoadingView();

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes("chatgpt.com")) {
      showErrorView("Please navigate to a ChatGPT conversation page first!");
      return;
    }

    // First, try to ping the content script to see if it's ready
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "ping" });
    } catch (pingError) {
      console.log("Content script not ready, attempting to inject...");

      // Try to inject content script programmatically
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js']
        });

        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.error("Failed to inject content script:", injectError);
        showErrorView("Failed to initialize extension. Please refresh the ChatGPT page and try again.");
        return;
      }
    }

    // Now send the actual extraction message
    console.log("Sending extraction message...");
    const response = await chrome.tabs.sendMessage(tab.id, { action: "extractQueries" });

    if (response.success) {
      console.log("Success! Messages:", response.messages);
      console.log("Search queries:", response.queries);
      console.log("Search nodes:", response.searchNodes);

      displayResults(response);
      showResultsView();
    } else {
      console.error("Extraction failed:", response.error);
      showErrorView("Error extracting queries: " + response.error);
    }

  } catch (error) {
    console.error("Communication error:", error);

    if (error.message?.includes("Receiving end does not exist")) {
      showErrorView("Extension not ready. Please refresh the ChatGPT page and try again.");
    } else {
      showErrorView("Error: " + error.message);
    }
  }
};