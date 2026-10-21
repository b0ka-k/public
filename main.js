const { Plugin, PluginSettingTab, Setting, Notice, requestUrl, normalizePath } = require("obsidian");

const DEFAULT_SETTINGS = {
  serverUrl: "https://ntfy.sh",
  topic: "",
  senderName: "Никита",
  includeFolder: true,
  includeVaultName: false
};

module.exports = class NtfyNoteNotifier extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "notify-active-note",
      name: "Уведомить о текущей заметке через ntfy",
      callback: () => this.notifyActiveNote()
    });

    this.addRibbonIcon("bell-ring", "Уведомить о текущей заметке через ntfy", () => {
      this.notifyActiveNote();
    });

    this.addSettingTab(new NtfySettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async notifyActiveNote() {
    const { serverUrl, topic, senderName, includeFolder, includeVaultName } = this.settings;

    if (!topic.trim()) {
      new Notice("ntfy: сначала укажи имя темы в настройках плагина.");
      return;
    }

    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("ntfy: сначала открой заметку, о которой нужно уведомить.");
      return;
    }

    const vaultName = this.app.vault.getName();
    const title = file.basename || file.name;
    const folder = file.parent && file.parent.path !== "/" ? file.parent.path : "Корень";
    const parts = [];
    if (includeFolder) parts.push(`Папка: ${folder}`);
    parts.push(title);
    if (includeVaultName) parts.push(`Хранилище: ${vaultName}`);

    const body = `${senderName.trim() || "Пользователь"} добавил(а) или обновил(а) заметку.\n${parts.join("\n")}`;
    const url = `${serverUrl.replace(/\/+$/, "")}/${encodeURIComponent(topic.trim())}`;
    const vaultParam = encodeURIComponent(vaultName);
    const fileParam = encodeURIComponent(file.path);
    const clickUrl = `obsidian://open?vault=${vaultParam}&file=${fileParam}`;

    try {
      const response = await requestUrl({
        url,
        method: "POST",
        headers: {
          "Title": `${senderName.trim() || "Obsidian"} · ${title}`,
          "Tags": "memo",
          "Click": clickUrl,
          "Content-Type": "text/plain; charset=utf-8"
        },
        body
      });

      if (response.status >= 200 && response.status < 300) {
        new Notice("Уведомление отправлено через ntfy.");
      } else {
        new Notice(`ntfy вернул статус ${response.status}.`);
      }
    } catch (error) {
      console.error("ntfy Note Notifier error:", error);
      new Notice("Не удалось отправить уведомление. Проверь URL сервера, тему и интернет.");
    }
  }
};

class NtfySettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "ntfy Note Notifier" });
    containerEl.createEl("p", {
      text: "Отправляет название активной заметки и её папку. Текст заметки не отправляется."
    });

    new Setting(containerEl)
      .setName("Адрес сервера ntfy")
      .setDesc("Для публичного сервиса оставь https://ntfy.sh")
      .addText(text => text
        .setPlaceholder("https://ntfy.sh")
        .setValue(this.plugin.settings.serverUrl)
        .onChange(async value => {
          this.plugin.settings.serverUrl = value.trim() || "https://ntfy.sh";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Имя темы (topic)")
      .setDesc("Секретное случайное имя темы. Все устройства-получатели должны подписаться на ту же тему.")
      .addText(text => text
        .setPlaceholder("например, our-vault-случайная-строка")
        .setValue(this.plugin.settings.topic)
        .onChange(async value => {
          this.plugin.settings.topic = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Имя отправителя")
      .setDesc("Например, Никита")
      .addText(text => text
        .setPlaceholder("Никита")
        .setValue(this.plugin.settings.senderName)
        .onChange(async value => {
          this.plugin.settings.senderName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Указывать папку заметки")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeFolder)
        .onChange(async value => {
          this.plugin.settings.includeFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Указывать название Vault")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeVaultName)
        .onChange(async value => {
          this.plugin.settings.includeVaultName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Тестовое уведомление")
      .setDesc("Открой любую заметку и нажми команду плагина, чтобы отправить тест.")
      .addButton(button => button
        .setButtonText("Отправить сейчас")
        .setCta()
        .onClick(() => this.plugin.notifyActiveNote()));
  }
}
