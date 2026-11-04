/**
 * EV Charging Slot Availability System
 * Main JavaScript: Navigation, Animations, Counters, Live Simulation
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Menu Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            const icon = mobileToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
    }

    // 2. Animated Counters for Stats Section
    const counters = document.querySelectorAll('.counter-anim');
    if (counters.length > 0) {
        const observerOptions = { threshold: 0.3 };
        const counterObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counter = entry.target;
                    const target = parseFloat(counter.getAttribute('data-target'));
                    const isPct = counter.getAttribute('data-suffix') === '%';
                    const isPlus = counter.getAttribute('data-suffix') === '+';
                    let current = 0;
                    const duration = 1500;
                    const stepTime = 20;
                    const steps = duration / stepTime;
                    const increment = target / steps;

                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            current = target;
                            clearInterval(timer);
                        }
                        if (isPct) {
                            counter.innerText = current.toFixed(1) + '%';
                        } else if (isPlus) {
                            counter.innerText = Math.floor(current).toLocaleString() + '+';
                        } else {
                            counter.innerText = Math.floor(current).toLocaleString();
                        }
                    }, stepTime);

                    observer.unobserve(counter);
                }
            });
        }, observerOptions);

        counters.forEach(c => counterObserver.observe(c));
    }

    // 3. Auto dismiss flash alerts
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.4s ease';
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 400);
        }, 5000);
    });

    // 4. Live Telemetry Pulse Simulation (Faculty Demo button)
    const livePulseBtn = document.getElementById('livePulseBtn');
    if (livePulseBtn) {
        livePulseBtn.addEventListener('click', async () => {
            try {
                livePulseBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Polling Telemetry...';
                const resp = await fetch('/api/simulate-live-pulse', { method: 'POST' });
                const res = await resp.json();
                if (res.success) {
                    showToast(res.message, 'success');
                    // Refresh current view if on station page
                    setTimeout(() => window.location.reload(), 1200);
                } else {
                    showToast(res.message, 'info');
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to poll telemetry simulator', 'error');
            } finally {
                livePulseBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Live Telemetry Pulse';
            }
        });
    }
});

// Toast notification utility
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.bottom = '24px';
        container.style.right = '24px';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : type}`;
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    toast.style.margin = '0';
    toast.style.animation = 'slideInRight 0.3s ease';

    const iconMap = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-triangle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    const icon = iconMap[type] || 'fa-info-circle';

    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        </div>
        <button type="button" class="alert-close" onclick="this.parentElement.remove()" style="margin-left:14px;">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}



// ===================================================================
// GEMINI AI ASSISTANT CHATBOT LOGIC
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    const aiToggle = document.getElementById('aiChatToggle');
    const aiDrawer = document.getElementById('aiChatDrawer');
    const closeBtn = document.getElementById('closeAiChat');
    const aiForm = document.getElementById('aiChatForm');
    const aiInput = document.getElementById('aiChatInput');
    const messagesBox = document.getElementById('aiChatMessages');

    if (aiToggle && aiDrawer) {
        aiToggle.addEventListener('click', () => {
            aiDrawer.classList.toggle('open');
            if (aiDrawer.classList.contains('open') && aiInput) {
                setTimeout(() => aiInput.focus(), 200);
            }
        });
    }

    if (closeBtn && aiDrawer) {
        closeBtn.addEventListener('click', () => {
            aiDrawer.classList.remove('open');
        });
    }

    if (aiForm && aiInput && messagesBox) {
        aiForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = aiInput.value.trim();
            if (!text) return;

            // Append user bubble
            appendMessage(text, 'user');
            aiInput.value = '';

            // Add typing indicator
            const typingId = 'typing-' + Date.now();
            const typingElem = document.createElement('div');
            typingElem.className = 'ai-message assistant';
            typingElem.id = typingId;
            typingElem.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gemini AI is analyzing...';
            messagesBox.appendChild(typingElem);
            messagesBox.scrollTop = messagesBox.scrollHeight;

            try {
                const resp = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });
                const res = await resp.json();
                const indicator = document.getElementById(typingId);
                if (indicator) indicator.remove();

                if (res.success && res.reply) {
                    appendMessage(formatAiReply(res.reply), 'assistant', true);
                } else {
                    appendMessage('Could not retrieve response from AI service.', 'assistant');
                }
            } catch (err) {
                const indicator = document.getElementById(typingId);
                if (indicator) indicator.remove();
                appendMessage('Network connection error while contacting AI service.', 'assistant');
            }
        });
    }
});

function askQuickPrompt(promptText) {
    const aiDrawer = document.getElementById('aiChatDrawer');
    if (aiDrawer && !aiDrawer.classList.contains('open')) {
        aiDrawer.classList.add('open');
    }
    const aiInput = document.getElementById('aiChatInput');
    if (aiInput) {
        aiInput.value = promptText;
        document.getElementById('aiChatForm')?.dispatchEvent(new Event('submit'));
    }
}

function appendMessage(text, role, isHtml = false) {
    const box = document.getElementById('aiChatMessages');
    if (!box) return;

    const msg = document.createElement('div');
    msg.className = `ai-message ${role}`;
    if (isHtml) {
        msg.innerHTML = text;
    } else {
        msg.innerText = text;
    }
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
}

function formatAiReply(text) {
    // Simple markdown parser for bold, bullets, newlines
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\* (.*$)/gim, '<div style="margin-left:8px;">&bull; $1</div>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
    return formatted;
}
