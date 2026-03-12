import type { DeckInstance, DeckPreset, SpawnDeckMode } from '../deck/DeckTypes';
import { getLanguagePreference, t, type LanguagePreference } from '../i18n';
import { SimpleSelect } from './SimpleSelect';

export class ControlPanel {
  readonly element = document.createElement('div');
  readonly toggleButton = document.createElement('button');
  readonly languageSelect = new SimpleSelect();
  readonly shuffleButton = document.createElement('button');
  readonly spreadButton = document.createElement('button');
  readonly returnButton = document.createElement('button');
  readonly jumperToggle = document.createElement('input');
  readonly tableFeltToggle = document.createElement('input');
  readonly modeSelect = new SimpleSelect();
  readonly presetSelect = new SimpleSelect();
  readonly spawnButton = document.createElement('button');
  readonly deletePresetButton = document.createElement('button');
  readonly instanceSelect = new SimpleSelect();
  readonly activateInstanceButton = document.createElement('button');
  readonly removeInstanceButton = document.createElement('button');
  readonly openEditorButton = document.createElement('button');
  readonly contactAuthorButton = document.createElement('button');
  readonly contactAuthorSection: HTMLElement;
  readonly statusText = document.createElement('div');
  readonly authorModal = document.createElement('div');
  readonly authorModalPanel = document.createElement('div');
  readonly authorModalCloseButton = document.createElement('button');
  readonly authorModalTitle = document.createElement('div');
  readonly authorNote = document.createElement('div');
  readonly authorLinkButton = document.createElement('button');
  private collapsed = false;
  private readonly sectionSummaries = new Map<string, HTMLElement>();
  private presetsSignature = '';
  private instancesSignature = '';
  private selectedInstanceId = '';
  private selectedSpawnMode: SpawnDeckMode = 'full78';
  private readonly authorXUrl = 'https://x.com/void_yuu';
  private copyResetTimer: number | null = null;

  constructor() {
    this.element.className = 'panel dock';
    this.toggleButton.type = 'button';
    this.shuffleButton.type = 'button';
    this.spreadButton.type = 'button';
    this.returnButton.type = 'button';
    this.jumperToggle.type = 'checkbox';
    this.jumperToggle.checked = true;
    this.tableFeltToggle.type = 'checkbox';
    this.tableFeltToggle.checked = true;
    this.spawnButton.type = 'button';
    this.deletePresetButton.type = 'button';
    this.activateInstanceButton.type = 'button';
    this.removeInstanceButton.type = 'button';
    this.openEditorButton.type = 'button';
    this.contactAuthorButton.type = 'button';
    this.statusText.className = 'panel-text';
    this.contactAuthorButton.className = 'dock-contact-button';
    this.authorModal.className = 'deck-editor-modal hidden';
    this.authorModalPanel.className = 'deck-editor-modal-panel dock-contact-modal-panel';
    this.authorModalCloseButton.className = 'deck-editor-modal-close';
    this.authorModalTitle.className = 'panel-heading';
    this.authorNote.className = 'dock-contact-note';
    this.authorLinkButton.className = 'dock-contact-link';
    this.authorLinkButton.type = 'button';
    this.contactAuthorSection = this.createSection('ui.contactAuthor', [this.contactAuthorButton]);
    this.contactAuthorSection.classList.add('dock-contact-section');

    this.element.append(
      this.toggleButton,
      this.createSection('ui.language', [this.languageSelect.element]),
      this.createSection('ui.actions', [
        this.shuffleButton,
        this.spreadButton,
        this.returnButton,
        this.wrapInline(t('ui.enableJumperCards'), this.jumperToggle),
        this.wrapInline(t('ui.showTableFelt'), this.tableFeltToggle),
      ]),
      this.createSection('ui.editDeckSection', [this.openEditorButton]),
      this.createSection('ui.spawnDeck', [this.presetSelect.element, this.modeSelect.element, this.spawnButton, this.deletePresetButton]),
      this.createSection('ui.deckInstances', [this.instanceSelect.element, this.removeInstanceButton, this.statusText]),
      this.contactAuthorSection,
    );
    this.authorModalPanel.append(this.authorModalCloseButton, this.authorModalTitle, this.authorNote, this.authorLinkButton);
    this.authorModal.append(this.authorModalPanel);

    if (typeof document !== 'undefined') {
      document.body.appendChild(this.authorModal);
    }

    this.toggleButton.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.element.classList.toggle('collapsed', this.collapsed);
      this.toggleButton.textContent = this.collapsed ? '>' : '<';
    });
    this.contactAuthorButton.addEventListener('click', () => {
      this.openAuthorModal();
    });
    this.authorModalCloseButton.addEventListener('click', () => {
      this.closeAuthorModal();
    });
    this.authorLinkButton.addEventListener('click', () => {
      void this.copyAuthorLink();
    });
    this.authorModal.addEventListener('click', (event) => {
      if (event.target === this.authorModal) {
        this.closeAuthorModal();
      }
    });

    this.toggleButton.textContent = '<';
    this.applyTranslations();
  }

  getSelectedPresetId(): string | null {
    return this.presetSelect.value || null;
  }

  getSelectedInstanceId(): string | null {
    return this.selectedInstanceId || this.instanceSelect.value || null;
  }

  getSelectedMode(): SpawnDeckMode {
    const value = this.modeSelect.value;
    return value === 'fullPreset' || value === 'full78' || value === 'major22' ? value : 'full78';
  }

  getSelectedLanguage(): LanguagePreference {
    const value = this.languageSelect.value;
    return value === 'en' || value === 'zh-TW' || value === 'ja' || value === 'auto' ? value : 'auto';
  }

  isJumperEnabled(): boolean {
    return this.jumperToggle.checked;
  }

  isTableFeltVisible(): boolean {
    return this.tableFeltToggle.checked;
  }

  applyTranslations(): void {
    this.shuffleButton.textContent = t('ui.shuffleActiveDeck');
    this.spreadButton.textContent = t('ui.spreadActiveDeck');
    this.returnButton.textContent = t('ui.returnSelectedToDeck');
    this.spawnButton.textContent = t('ui.spawnDeckButton');
    this.deletePresetButton.textContent = t('ui.deletePreset');
    this.activateInstanceButton.textContent = t('ui.setActive');
    this.removeInstanceButton.textContent = t('ui.removeDeck');
    this.openEditorButton.textContent = t('ui.editDeck');
    this.contactAuthorButton.textContent = t('ui.contactAuthor');
    this.authorModalCloseButton.textContent = '×';
    this.authorModalCloseButton.title = t('ui.close');
    this.authorModalTitle.textContent = t('ui.contactAuthor');
    this.authorNote.textContent = t('ui.authorNote');
    this.authorLinkButton.textContent = t('ui.authorLink');
    this.languageSelect.setOptions([
      { value: 'auto', label: t('lang.auto') },
      { value: 'en', label: t('lang.en') },
      { value: 'zh-TW', label: t('lang.zh-TW') },
      { value: 'ja', label: t('lang.ja') },
    ]);
    this.languageSelect.setValue(getLanguagePreference());
    this.instancesSignature = '';
    this.sectionSummaries.forEach((summary, key) => {
      summary.textContent = t(key);
    });
  }

  syncSpawnModes(modes: SpawnDeckMode[]): void {
    const current = this.selectedSpawnMode;
    this.modeSelect.setOptions(
      modes.map((mode) => ({
        value: mode,
        label: t(`ui.mode.${mode}`),
      })),
    );
    this.selectedSpawnMode = modes.includes(current) ? current : modes.includes('full78') ? 'full78' : modes[0] ?? 'major22';
    this.modeSelect.setValue(this.selectedSpawnMode);
  }

  setSelectedSpawnMode(mode: SpawnDeckMode): void {
    this.selectedSpawnMode = mode;
    this.modeSelect.setValue(mode);
  }

  syncPresets(presets: DeckPreset[], selectedPresetId: string | null): void {
    const signature = presets.map((preset) => `${preset.id}:${preset.name}`).join('|');
    if (signature !== this.presetsSignature) {
      this.presetSelect.setOptions(presets.map((preset) => ({ value: preset.id, label: preset.name })));
      this.presetsSignature = signature;
    }
    this.presetSelect.setValue(selectedPresetId ?? '');
  }

  syncInstances(instances: DeckInstance[], activeInstanceId: string | null): void {
    const signature = instances
      .map((instance) => `${instance.id}:${instance.label}:${instance.id === activeInstanceId ? 'active' : 'idle'}`)
      .join('|');
    if (signature !== this.instancesSignature) {
      this.instanceSelect.setOptions(
        instances.map((instance) => ({
          value: instance.id,
          label: `${instance.label}${instance.id === activeInstanceId ? ` ${t('ui.activeSuffix')}` : ''}`,
        })),
      );
      this.instancesSignature = signature;
    }
    const hasSelected = instances.some((instance) => instance.id === this.selectedInstanceId);
    if (!hasSelected) {
      this.selectedInstanceId = activeInstanceId ?? instances[0]?.id ?? '';
    }
    this.instanceSelect.setValue(this.selectedInstanceId);
    this.statusText.textContent = t('ui.decksCount', { count: instances.length });
  }

  setSelectedInstanceId(instanceId: string | null): void {
    this.selectedInstanceId = instanceId ?? '';
    this.instanceSelect.setValue(this.selectedInstanceId);
  }

  private openAuthorModal(): void {
    this.authorModal.classList.remove('hidden');
  }

  private closeAuthorModal(): void {
    this.authorModal.classList.add('hidden');
  }

  private async copyAuthorLink(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.authorXUrl);
      } else {
        const input = document.createElement('input');
        input.value = this.authorXUrl;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      this.authorLinkButton.textContent = t('ui.authorLinkCopied');
      if (this.copyResetTimer !== null) {
        window.clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = window.setTimeout(() => {
        this.authorLinkButton.textContent = t('ui.authorLink');
        this.copyResetTimer = null;
      }, 1600);
    } catch {
      this.authorLinkButton.textContent = this.authorXUrl;
    }
  }

  private createSection(titleKey: string, controls: HTMLElement[]): HTMLElement {
    const details = document.createElement('details');
    details.className = 'dock-section';
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = t(titleKey);
    this.sectionSummaries.set(titleKey, summary);
    details.append(summary);
    controls.forEach((control) => details.append(control));
    return details;
  }

  private wrapInline(label: string, control: HTMLElement): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'panel-inline';
    const span = document.createElement('span');
    span.textContent = label;
    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      wrapper.classList.add('panel-inline-toggle');
      const switchTrack = document.createElement('span');
      switchTrack.className = 'toggle-switch';
      const switchThumb = document.createElement('span');
      switchThumb.className = 'toggle-switch-thumb';
      switchTrack.append(control, switchThumb);
      wrapper.append(span, switchTrack);
      return wrapper;
    }
    wrapper.append(span, control);
    return wrapper;
  }
}
