import { registerRoute, initRouter } from './router.js';
import { loadAuth } from './services/state.js';
import { initGlobalListeners } from './services/global-listeners.js';
import { Notifier } from './services/notifier.js';

// Pages
import { renderLanding } from './pages/landing.js';
import { renderLogin } from './pages/login.js';
import { renderAdminLogin } from './pages/admin-login.js';
import { renderRegister } from './pages/register.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderLeaderboard } from './pages/leaderboard.js';
import { renderElimination } from './pages/elimination.js';
import { renderAdmin } from './pages/admin.js';
import { renderEvents } from './pages/events.js';

// Round Engines
import { renderQuizRound } from './rounds/quiz-engine.js';
import { renderLogoRound } from './rounds/logo-engine.js';
import { renderPromptRound } from './rounds/prompt-engine.js';
import { renderWebdevRound } from './rounds/webdev-engine.js';
import { renderVideoRound } from './rounds/video-engine.js';
import { renderDebateRound } from './rounds/debate-engine.js';

// Register all routes
registerRoute('/', renderLanding);
registerRoute('/login', renderLogin);
registerRoute('/admin/login', renderAdminLogin);
registerRoute('/register', renderRegister);
registerRoute('/register/:eventSlug', renderRegister);
registerRoute('/dashboard', renderDashboard);
registerRoute('/leaderboard', renderLeaderboard);
registerRoute('/events', renderEvents);
registerRoute('/eliminated', renderElimination);
registerRoute('/admin', renderAdmin);

// Round routes
registerRoute('/round/quiz', renderQuizRound);
registerRoute('/round/logo', renderLogoRound);
registerRoute('/round/prompt', renderPromptRound);
registerRoute('/round/webdev', renderWebdevRound);
registerRoute('/round/video', renderVideoRound);
registerRoute('/round/debate', renderDebateRound);

// Load persisted auth and start router
const user = loadAuth();
initGlobalListeners();
initRouter();

// Start live systems
import { initRealtimeNotifier } from './services/realtime-notifier.js';
initRealtimeNotifier();

console.log('%c⚡ HostiBuzz v1.0', 'color: #a7a5ff; font-size: 16px; font-weight: bold; font-family: "Space Grotesk"');
console.log('%cOpen Source Technical Event Hosting Platform', 'color: #53ddfc; font-size: 12px');
