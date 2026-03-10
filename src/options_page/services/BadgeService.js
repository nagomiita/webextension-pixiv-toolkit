import AbstractService from "./AbstractService";
import browser from "@/modules/Extension/browser"

class BadgeService extends AbstractService {
  static instance;

  setIcon(path, sender) {
    try {
      const result = browser.action.setIcon({
        path: browser.runtime.getURL(path),
        tabId: sender.tab.id,
      });

      if (result && typeof result.catch === 'function') {
        result.catch(() => undefined);
      }
    } catch (error) {
      return undefined;
    }
  }

  static getService() {
    if (!BadgeService.instance) {
      BadgeService.instance = new BadgeService();
    }

    return BadgeService.instance;
  }

  activeIcon({ sender }) {
    return this.setIcon('./icon_active.png', sender);
  }

  deactiveAction({ sender }) {
    return this.setIcon('./icon.png', sender);
  }
}

export default BadgeService;
