(function () {
  const STORAGE_KEY = "mindease_cookie_consent";
  const existingChoice = window.localStorage.getItem(STORAGE_KEY);

  if (existingChoice) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    .cookie-banner {
      position: fixed;
      left: 20px;
      right: 20px;
      bottom: 20px;
      z-index: 3000;
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid #d9e4e2;
      border-radius: 18px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.12);
      padding: 18px;
      color: #2f3a3a;
      font-family: Arial, sans-serif;
    }

    .cookie-banner strong {
      display: block;
      color: #2f5d62;
      margin-bottom: 8px;
      font-size: 1rem;
    }

    .cookie-banner p {
      margin: 0 0 12px;
      line-height: 1.6;
      font-size: 14px;
    }

    .cookie-banner a {
      color: #2f5d62;
      font-weight: bold;
    }

    .cookie-banner-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .cookie-banner button {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
    }

    .cookie-banner .accept {
      background: #2f5d62;
      color: white;
    }

    .cookie-banner .decline {
      background: #edf4f3;
      color: #2f5d62;
    }

    @media (max-width: 640px) {
      .cookie-banner {
        left: 12px;
        right: 12px;
        bottom: 12px;
      }

      .cookie-banner-actions button {
        width: 100%;
      }
    }
  `;

  const banner = document.createElement("div");
  banner.className = "cookie-banner";
  banner.innerHTML = `
    <strong>Privacy choices</strong>
    <p>
      MindEase uses essential storage so sign-in, journaling, mood tracking, and the Priority Matrix can work.
      With your permission, MindEase also uses analytics cookies or similar technologies to understand site usage.
      See the <a href="/privacy.html">Privacy & Cookies</a> page for details.
    </p>
    <div class="cookie-banner-actions">
      <button type="button" class="accept">Allow analytics</button>
      <button type="button" class="decline">Continue without analytics</button>
    </div>
  `;

  function saveChoice(value) {
    window.localStorage.setItem(STORAGE_KEY, value);
    banner.remove();
    style.remove();
  }

  banner.querySelector(".accept").addEventListener("click", () => {
    saveChoice("granted");
  });

  banner.querySelector(".decline").addEventListener("click", () => {
    saveChoice("denied");
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.head.appendChild(style);
    document.body.appendChild(banner);
  });
})();
