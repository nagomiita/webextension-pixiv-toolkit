import browser from "@/modules/Extension/browser";
import Application from "./Application";

class Bootstrap {
  static initializeApplication(application) {
    Bootstrap.emitBeforeBoot(application);

    Bootstrap.bindEvents(application);
  }

  static bindableRuntimeEvents = [
    'onConnect', 'onInstalled', 'onMessage', 'onRestartRequired',
    'onStartup', 'onSuspend', 'onSuspendCanceled', 'onUpdateAvailable',
  ];

  static bindEvents(bindableInstance) {
    Bootstrap.bindableRuntimeEvents.forEach(event => {
      if (typeof bindableInstance[event] === 'function') {
        console.log(event, arguments);
        browser.runtime[event].addListener(function() {
          return bindableInstance[event].apply(bindableInstance, arguments);
        });
      }
    });
  }

  static emitBeforeBoot(application) {
    if (typeof application.onBeforeBoot === 'function') {
      application.onBeforeBoot.call(application);
    }
  }

  static boot(application) {
    application.onBooted.call(application);
  }
}

const application = Application.createApp();

Bootstrap.initializeApplication(application);

self.oninstall = () => {
  Bootstrap.boot(application);

  self.application = application;
};
