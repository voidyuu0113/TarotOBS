import type { AssetFolder, AssetRecord, DeckPreset, ExtraCardDefinition } from '../deck/DeckTypes';
import { t } from '../i18n';
import { SimpleSelect } from './SimpleSelect';

export interface DeckEditorDraft {
  id: string | null;
  name: string;
  backAssetId: string | null;
  assignments: Record<string, string | null>;
  extraCards: ExtraCardDefinition[];
}

export interface PreviewCardItem {
  id: string;
  kind: 'template' | 'custom';
  title: string;
  subtitle: string;
  frontAssetId: string | null;
}

export class DeckEditorOverlay {
  readonly element = document.createElement('aside');
  readonly closeButton = document.createElement('button');
  readonly presetSelect = new SimpleSelect();
  readonly presetNameInput = document.createElement('input');
  readonly new22Button = document.createElement('button');
  readonly new78Button = document.createElement('button');
  readonly saveButton = document.createElement('button');
  readonly deletePresetButton = document.createElement('button');
  readonly resetMaterialsButton = document.createElement('button');
  readonly searchInput = document.createElement('input');
  readonly clearAssignmentButton = document.createElement('button');
  readonly cardNameInput = document.createElement('input');
  readonly createFolderButton = document.createElement('button');
  readonly folderNameInput = document.createElement('input');
  readonly folderSelect = new SimpleSelect();
  readonly importAssetsButton = document.createElement('button');
  readonly replaceBackButton = document.createElement('button');
  readonly addExtraCardButton = document.createElement('button');
  readonly exportDeckButton = document.createElement('button');
  readonly importDeckButton = document.createElement('button');
  readonly currentBackBadge = document.createElement('div');
  readonly assetInput = document.createElement('input');
  readonly backInput = document.createElement('input');
  readonly deckImportInput = document.createElement('input');
  readonly previewList = document.createElement('div');
  readonly assetList = document.createElement('div');
  readonly statusText = document.createElement('div');
  readonly exportModal = document.createElement('div');
  readonly exportModalPanel = document.createElement('div');
  readonly exportModalCloseButton = document.createElement('button');
  readonly exportModalTitle = document.createElement('div');
  readonly exportModalHint = document.createElement('div');
  readonly exportDownloadPanel = document.createElement('div');
  readonly exportDownloadLink = document.createElement('a');
  readonly exportDownloadMeta = document.createElement('div');
  readonly exportTextArea = document.createElement('textarea');
  readonly importTextArea = document.createElement('textarea');
  readonly copyExportTextButton = document.createElement('button');
  readonly importTextButton = document.createElement('button');
  readonly importFileButton = document.createElement('button');
  readonly importModal = document.createElement('div');
  readonly importModalPanel = document.createElement('div');
  readonly importModalCloseButton = document.createElement('button');
  readonly importModalTitle = document.createElement('div');
  readonly openButton = document.createElement('button');
  readonly lightbox = document.createElement('div');
  readonly lightboxPanel = document.createElement('div');
  readonly lightboxCard = document.createElement('div');
  readonly lightboxSidebar = document.createElement('div');
  readonly lightboxCaption = document.createElement('div');
  readonly lightboxInfo = document.createElement('div');
  readonly lightboxNav = document.createElement('div');
  readonly lightboxPrevButton = document.createElement('button');
  readonly lightboxNextButton = document.createElement('button');
  readonly lightboxNameInput = document.createElement('input');
  readonly lightboxClearButton = document.createElement('button');
  readonly lightboxDeleteButton = document.createElement('button');
  readonly lightboxAssetList = document.createElement('div');
  readonly textInputs: HTMLInputElement[] = [];
  private presetOptionsSignature = '';
  private folderOptionsSignature = '';

  constructor() {
    this.element.className = 'deck-editor hidden';
    this.previewList.className = 'deck-editor-list';
    this.assetList.className = 'deck-editor-assets';
    this.statusText.className = 'panel-text';
    this.exportModal.className = 'deck-editor-modal hidden';
    this.exportModalPanel.className = 'deck-editor-modal-panel';
    this.exportModalCloseButton.className = 'deck-editor-modal-close';
    this.exportModalTitle.className = 'panel-heading';
    this.exportModalHint.className = 'deck-editor-modal-hint';
    this.exportDownloadPanel.className = 'deck-editor-export-download hidden';
    this.exportDownloadLink.className = 'deck-editor-export-link';
    this.exportDownloadMeta.className = 'deck-editor-export-meta';
    this.exportTextArea.className = 'deck-editor-export-text hidden';
    this.importTextArea.className = 'deck-editor-export-text';
    this.importFileButton.className = 'deck-editor-modal-primary';
    this.importModal.className = 'deck-editor-modal hidden';
    this.importModalPanel.className = 'deck-editor-modal-panel';
    this.importModalCloseButton.className = 'deck-editor-modal-close';
    this.importModalTitle.className = 'panel-heading';
    this.assetInput.className = 'deck-editor-hidden-input';
    this.backInput.className = 'deck-editor-hidden-input';
    this.deckImportInput.className = 'deck-editor-hidden-input';
    this.lightbox.className = 'deck-editor-lightbox hidden';
    this.lightboxPanel.className = 'deck-editor-lightbox-panel';
    this.lightboxCard.className = 'deck-editor-lightbox-card';
    this.lightboxSidebar.className = 'deck-editor-lightbox-sidebar';
    this.lightboxCaption.className = 'deck-editor-lightbox-caption';
    this.lightboxInfo.className = 'deck-editor-detail-info';
    this.lightboxNav.className = 'deck-editor-lightbox-nav';
    this.lightboxNameInput.className = 'deck-editor-lightbox-name';
    this.lightboxDeleteButton.className = 'deck-editor-lightbox-delete hidden';
    this.lightboxAssetList.className = 'deck-editor-lightbox-assets';

    this.closeButton.type = 'button';
    this.new22Button.type = 'button';
    this.new78Button.type = 'button';
    this.saveButton.type = 'button';
    this.deletePresetButton.type = 'button';
    this.clearAssignmentButton.type = 'button';
    this.resetMaterialsButton.type = 'button';
    this.createFolderButton.type = 'button';
    this.importAssetsButton.type = 'button';
    this.replaceBackButton.type = 'button';
    this.addExtraCardButton.type = 'button';
    this.exportDeckButton.type = 'button';
    this.importDeckButton.type = 'button';
    this.copyExportTextButton.type = 'button';
    this.importTextButton.type = 'button';
    this.importFileButton.type = 'button';
    this.openButton.type = 'button';
    this.assetInput.type = 'file';
    this.assetInput.accept = 'image/*';
    this.assetInput.multiple = true;
    this.backInput.type = 'file';
    this.backInput.accept = 'image/*';
    this.deckImportInput.type = 'file';
    this.deckImportInput.accept = '.tarotpack';
    this.deckImportInput.multiple = true;
    this.presetNameInput.type = 'text';
    this.cardNameInput.type = 'text';
    this.lightboxNameInput.type = 'text';
    this.searchInput.type = 'search';
    this.folderNameInput.type = 'text';
    this.exportTextArea.readOnly = true;
    this.importTextArea.readOnly = false;
    this.exportModalCloseButton.type = 'button';
    this.importModalCloseButton.type = 'button';
    this.lightboxPrevButton.type = 'button';
    this.lightboxNextButton.type = 'button';
    this.lightboxClearButton.type = 'button';
    this.lightboxDeleteButton.type = 'button';
    this.textInputs.push(this.presetNameInput, this.searchInput, this.cardNameInput, this.folderNameInput, this.lightboxNameInput);
    this.textInputs.forEach((input) => {
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('spellcheck', 'false');
    });

    const topBar = document.createElement('div');
    topBar.className = 'deck-editor-topbar';
    const topActions = document.createElement('div');
    topActions.className = 'deck-editor-topbar-actions';
    topActions.append(
      this.new22Button,
      this.new78Button,
      this.saveButton,
      this.resetMaterialsButton,
      this.deletePresetButton,
    );
    topBar.append(
      this.presetSelect.element,
      this.presetNameInput,
      topActions,
      this.searchInput,
      this.closeButton,
    );

    const center = document.createElement('div');
    center.className = 'deck-editor-body';

    const previews = document.createElement('section');
    previews.className = 'deck-editor-column';
    previews.append(this.previewList);

    const assets = document.createElement('section');
    assets.className = 'deck-editor-column deck-editor-sidebar';
    const librarySection = document.createElement('div');
    librarySection.className = 'deck-editor-side-section';
    const libraryHeading = document.createElement('div');
    libraryHeading.className = 'panel-heading';
    libraryHeading.dataset.i18nKey = 'ui.assetLibrary';
    const importRow = document.createElement('div');
    importRow.className = 'deck-editor-import-row';
    const importButtons = document.createElement('div');
    importButtons.className = 'deck-editor-import-buttons';
    importButtons.append(this.importAssetsButton, this.replaceBackButton, this.addExtraCardButton, this.exportDeckButton, this.importDeckButton);
    this.currentBackBadge.className = 'deck-editor-current-back';
    importRow.append(importButtons, this.currentBackBadge);
    librarySection.append(libraryHeading, importRow, this.assetInput, this.backInput);

    const foldersSection = document.createElement('div');
    foldersSection.className = 'deck-editor-side-section';
    const foldersHeading = document.createElement('div');
    foldersHeading.className = 'panel-heading';
    foldersHeading.dataset.i18nKey = 'ui.assetFolders';
    const folderCurrentLabel = document.createElement('div');
    folderCurrentLabel.className = 'deck-editor-field-label';
    folderCurrentLabel.dataset.i18nKey = 'ui.currentFolder';

    const folderRow = document.createElement('div');
    folderRow.className = 'deck-editor-folder-row';
    folderRow.append(this.folderNameInput, this.createFolderButton);
    foldersSection.append(foldersHeading, folderCurrentLabel, this.folderSelect.element, folderRow);

    const assetsSection = document.createElement('div');
    assetsSection.className = 'deck-editor-side-section deck-editor-assets-section';
    const assetsHeading = document.createElement('div');
    assetsHeading.className = 'panel-heading';
    assetsHeading.dataset.i18nKey = 'folder.allAssets';
    assetsSection.append(assetsHeading, this.assetList, this.statusText);

    assets.append(librarySection, foldersSection, assetsSection);

    center.append(previews, assets);
    this.closeButton.className = 'deck-editor-close';
    this.lightboxNav.append(this.lightboxPrevButton, this.lightboxNextButton);
    const lightboxActions = document.createElement('div');
    lightboxActions.className = 'deck-editor-lightbox-actions';
    lightboxActions.append(this.lightboxClearButton, this.lightboxDeleteButton);
    this.lightboxSidebar.append(
      this.lightboxCaption,
      this.lightboxInfo,
      this.lightboxNav,
      this.lightboxNameInput,
      lightboxActions,
      this.lightboxAssetList,
    );
    this.lightboxPanel.append(this.lightboxCard, this.lightboxSidebar);
    this.lightbox.append(this.lightboxPanel);
    this.exportDownloadPanel.append(this.exportDownloadLink, this.exportDownloadMeta);
    const exportActions = document.createElement('div');
    exportActions.className = 'deck-editor-transfer-buttons';
    exportActions.append(this.copyExportTextButton);
    this.exportModalPanel.append(
      this.exportModalCloseButton,
      this.exportModalTitle,
      this.exportModalHint,
      this.exportDownloadPanel,
      this.exportTextArea,
      exportActions,
    );
    this.importModalPanel.append(
      this.importModalCloseButton,
      this.importModalTitle,
      this.importFileButton,
      this.importTextArea,
      this.importTextButton,
      this.deckImportInput,
    );
    this.exportModal.append(this.exportModalPanel);
    this.importModal.append(this.importModalPanel);
    this.element.append(topBar, center);
    this.lightbox.addEventListener('click', (event) => {
      if (event.target === this.lightbox) {
        this.closeLightbox();
      }
    });
    this.exportModal.addEventListener('click', (event) => {
      if (event.target === this.exportModal) {
        this.closeExportModal();
      }
    });
    this.importModal.addEventListener('click', (event) => {
      if (event.target === this.importModal) {
        this.closeImportModal();
      }
    });
    if (typeof document !== 'undefined') {
      document.body.appendChild(this.lightbox);
      document.body.appendChild(this.exportModal);
      document.body.appendChild(this.importModal);
    }

    this.openButton.className = 'dock-open-editor';
    this.applyTranslations();
  }

  open(): void {
    this.element.classList.remove('hidden');
  }

  close(): void {
    this.element.classList.add('hidden');
    this.closeExportModal();
    this.closeImportModal();
  }

  isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }

  getSelectedPresetId(): string | null {
    return this.presetSelect.value || null;
  }

  getSelectedFolderId(): string | null {
    return this.folderSelect.value || null;
  }

  getSearchTerm(): string {
    return this.searchInput.value.trim().toLowerCase();
  }

  getCardName(): string {
    return this.cardNameInput.value.trim();
  }

  getFolderName(): string {
    return this.folderNameInput.value.trim();
  }

  getImportedAssets(): File[] {
    return Array.from(this.assetInput.files ?? []);
  }

  getBackFile(): File | null {
    return this.backInput.files?.[0] ?? null;
  }

  clearImports(): void {
    this.assetInput.value = '';
    this.backInput.value = '';
  }

  triggerAssetImport(): void {
    this.assetInput.click();
  }

  triggerBackImport(): void {
    this.backInput.click();
  }

  triggerDeckImport(): void {
    this.deckImportInput.click();
  }

  openExportModal(): void {
    this.exportModal.classList.remove('hidden');
  }

  closeExportModal(): void {
    this.exportModal.classList.add('hidden');
  }

  openImportModal(): void {
    this.importModal.classList.remove('hidden');
  }

  closeImportModal(): void {
    this.importModal.classList.add('hidden');
  }

  setStatus(message: string): void {
    this.statusText.textContent = message;
  }

  setExportDownload(filename: string, url: string, meta: string): void {
    this.exportDownloadLink.href = url;
    this.exportDownloadLink.download = filename;
    this.exportDownloadLink.textContent = t('ui.downloadTarotPack');
    this.exportDownloadMeta.textContent = meta;
    this.exportDownloadPanel.classList.remove('hidden');
  }

  setExportText(value: string): void {
    this.exportTextArea.value = value;
    this.exportTextArea.classList.toggle('hidden', value.length === 0);
  }

  getImportText(): string {
    return this.importTextArea.value.trim();
  }

  clearExportDownload(): void {
    this.exportDownloadLink.removeAttribute('href');
    this.exportDownloadLink.removeAttribute('download');
    this.exportDownloadLink.textContent = '';
    this.exportDownloadMeta.textContent = '';
    this.exportDownloadPanel.classList.add('hidden');
    this.setExportText('');
    this.importTextArea.value = '';
  }

  setCurrentBackLabel(label: string | null): void {
    this.currentBackBadge.textContent = `${t('ui.currentBack')}: ${label ?? t('ui.missing')}`;
  }

  applyTranslations(): void {
    this.closeButton.textContent = '×';
    this.closeButton.setAttribute('aria-label', t('ui.close'));
    this.closeButton.title = t('ui.close');
    this.new22Button.textContent = t('ui.new22Preset');
    this.new78Button.textContent = t('ui.new78Preset');
    this.saveButton.textContent = t('ui.saveDeck');
    this.deletePresetButton.textContent = t('ui.deleteDeckPreset');
    this.clearAssignmentButton.textContent = t('ui.clearAssignment');
    this.resetMaterialsButton.textContent = t('ui.resetAllMaterials');
    this.lightboxClearButton.textContent = t('ui.clearAssignment');
    this.lightboxDeleteButton.textContent = t('ui.deleteCustomCard');
    this.lightboxPrevButton.textContent = t('ui.prevCard');
    this.lightboxNextButton.textContent = t('ui.nextCard');
    this.createFolderButton.textContent = '+';
    this.importAssetsButton.textContent = t('ui.importFrontAssetsShort');
    this.replaceBackButton.textContent = t('ui.replaceSharedBackShort');
    this.addExtraCardButton.textContent = t('ui.addExtraCardShort');
    this.exportDeckButton.textContent = t('ui.exportDeck');
    this.importDeckButton.textContent = t('ui.importDeck');
    this.copyExportTextButton.textContent = t('ui.copyPackText');
    this.importTextButton.textContent = t('ui.importPackText');
    this.importFileButton.textContent = t('ui.importDeckFile');
    this.exportModalCloseButton.textContent = '×';
    this.importModalCloseButton.textContent = '×';
    this.exportModalCloseButton.title = t('ui.close');
    this.importModalCloseButton.title = t('ui.close');
    this.exportModalTitle.textContent = t('ui.exportDeck');
    this.importModalTitle.textContent = t('ui.importDeck');
    this.exportModalHint.textContent = t('ui.obsExportHint');
    this.importAssetsButton.title = t('ui.importFrontAssets');
    this.replaceBackButton.title = t('ui.replaceSharedBack');
    this.addExtraCardButton.title = t('ui.addExtraCard');
    this.exportDeckButton.title = t('ui.exportDeck');
    this.importDeckButton.title = t('ui.importDeck');
    this.copyExportTextButton.title = t('ui.copyPackText');
    this.importTextButton.title = t('ui.importPackText');
    this.lightboxDeleteButton.title = t('ui.deleteCustomCard');
    this.openButton.textContent = t('ui.editDeck');
    this.presetNameInput.placeholder = t('ui.presetNamePlaceholder');
    this.cardNameInput.placeholder = t('ui.cardNamePlaceholder');
    this.lightboxNameInput.placeholder = t('ui.cardNamePlaceholder');
    this.searchInput.placeholder = t('ui.searchCards');
    this.folderNameInput.placeholder = t('ui.folderNamePlaceholder');
    this.exportTextArea.placeholder = t('ui.exportPackTextPlaceholder');
    this.importTextArea.placeholder = t('ui.importPackTextPlaceholder');
    this.element.querySelectorAll<HTMLElement>('[data-i18n-key]').forEach((node) => {
      node.textContent = t(node.dataset.i18nKey ?? '');
    });
  }

  syncPresetOptions(presets: DeckPreset[], selectedPresetId: string | null): void {
    const signature = presets.map((preset) => `${preset.id}:${preset.name}`).join('|');
    if (signature !== this.presetOptionsSignature) {
      this.presetSelect.setOptions(presets.map((preset) => ({ value: preset.id, label: preset.name })));
      this.presetOptionsSignature = signature;
    }
    this.presetSelect.setValue(selectedPresetId ?? '');
  }

  syncFolders(folders: AssetFolder[], selectedFolderId: string | null): void {
    const signature = folders.map((folder) => `${folder.id}:${this.getFolderLabel(folder)}`).join('|');
    if (signature !== this.folderOptionsSignature) {
      this.folderSelect.setOptions(folders.map((folder) => ({ value: folder.id, label: this.getFolderLabel(folder) })));
      this.folderOptionsSignature = signature;
    }
    this.folderSelect.setValue(selectedFolderId ?? '');
  }

  syncPreviewList(
    cards: PreviewCardItem[],
    previewUrls: Map<string, string | null>,
    previewAspectRatios: Map<string, number>,
    onOpenPreview: (id: string) => void,
  ): void {
    
    this.previewList.replaceChildren();
    
    cards.forEach((card) => {
      
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'deck-editor-card';
      
      const preview = document.createElement('div');
      preview.className = 'deck-editor-thumb';
      const url = previewUrls.get(card.id);
      
      preview.style.aspectRatio = String(previewAspectRatios.get(card.id) ?? 96 / 156);
      if (url) {
        preview.style.backgroundImage = `url("${url}")`;
      } else {
        preview.textContent = card.title;
      }
      const title = document.createElement('div');
      title.className = 'deck-editor-card-title';
      title.textContent = card.title;
      const subtitle = document.createElement('div');
      subtitle.className = 'deck-editor-card-subtitle';
      subtitle.textContent = card.subtitle;
      
      // Open on pointerdown so an input blur/change rerender cannot replace the
      // card DOM before the later click event gets a chance to fire.
      item.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        onOpenPreview(card.id);
      });
      
      item.append(preview, title, subtitle);
      this.previewList.appendChild(item);
    });
  }

  syncDetail(
    selectedCard: PreviewCardItem | null,
    previewUrl: string | null,
    previewAspectRatio: number | null,
    assignedAssetLabel: string | null,
    backAssetLabel: string | null,
  ): void {
    this.lightboxCard.style.aspectRatio = String(previewAspectRatio ?? 96 / 156);
    this.lightboxCard.style.backgroundImage = previewUrl ? `url("${previewUrl}")` : '';
    this.lightboxCard.textContent = previewUrl || !selectedCard ? '' : selectedCard.title;
    this.lightboxCaption.textContent = selectedCard?.title ?? '';
    if (document.activeElement !== this.lightboxNameInput) {
      this.lightboxNameInput.value = selectedCard?.title ?? '';
    }
    this.lightboxNameInput.disabled = selectedCard?.kind !== 'custom';
    this.lightboxDeleteButton.classList.toggle('hidden', selectedCard?.kind !== 'custom');
    this.lightboxInfo.textContent = selectedCard
      ? `${selectedCard.subtitle} | ${t('ui.currentAsset')}: ${assignedAssetLabel ?? t('ui.unassigned')} | ${t('ui.currentBack')}: ${backAssetLabel ?? t('ui.missing')}`
      : t('ui.noCardSelected');
  }

  syncDraftTextInputs(presetName: string): void {
    if (document.activeElement !== this.presetNameInput) {
      this.presetNameInput.value = presetName;
    }
  }

  openLightbox(previewUrl: string | null, title: string, aspectRatio: number | null): void {
    this.lightboxCard.style.aspectRatio = String(aspectRatio ?? 96 / 156);
    this.lightboxCard.style.backgroundImage = previewUrl ? `url("${previewUrl}")` : '';
    this.lightboxCard.textContent = previewUrl ? '' : title;
    this.lightboxCaption.textContent = title;
    this.lightbox.classList.remove('hidden');
    this.lightbox.classList.add('visible');
  }

  closeLightbox(): void {
    this.lightbox.classList.remove('visible');
    this.lightbox.classList.add('hidden');
  }

  syncAssetList(
    assets: AssetRecord[],
    selectedFolderId: string | null,
    previewUrls: Map<string, string | null>,
    onAssign: (assetId: string) => void,
  ): void {
    this.syncAssetListWithDelete(assets, selectedFolderId, previewUrls, onAssign, () => undefined, () => false);
  }

  syncAssetListWithDelete(
    assets: AssetRecord[],
    selectedFolderId: string | null,
    previewUrls: Map<string, string | null>,
    onAssign: (assetId: string) => void,
    onDelete: (assetId: string) => void,
    canDelete: (assetId: string) => boolean,
  ): void {
    this.assetList.replaceChildren();
    assets
      .filter((asset) => asset.kind === 'front' && (!selectedFolderId || asset.folderId === selectedFolderId))
      .forEach((asset) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'deck-editor-asset-card';
        const preview = document.createElement('div');
        preview.className = 'deck-editor-asset-thumb';
        const previewUrl = previewUrls.get(asset.id);
        if (previewUrl) {
          preview.style.backgroundImage = `url("${previewUrl}")`;
        } else {
          preview.textContent = asset.label;
        }
        const label = document.createElement('div');
        label.className = 'deck-editor-asset-label';
        label.textContent = asset.label;
        item.append(preview, label);
        item.addEventListener('click', () => onAssign(asset.id));
        if (canDelete(asset.id)) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'deck-editor-asset-remove';
          remove.textContent = 'x';
          remove.addEventListener('click', (event) => {
            event.stopPropagation();
            onDelete(asset.id);
          });
          item.append(remove);
        }
        this.assetList.appendChild(item);
      });
  }

  syncLightboxAssets(
    assets: AssetRecord[],
    selectedFolderId: string | null,
    previewUrls: Map<string, string | null>,
    onAssign: (assetId: string) => void,
    onDelete: (assetId: string) => void,
    canDelete: (assetId: string) => boolean,
  ): void {
    this.lightboxAssetList.replaceChildren();
    assets
      .filter((asset) => asset.kind === 'front' && (!selectedFolderId || asset.folderId === selectedFolderId))
      .forEach((asset) => {
        const row = document.createElement('div');
        row.className = 'deck-editor-lightbox-asset-card';
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'deck-editor-lightbox-asset-button';
        const preview = document.createElement('div');
        preview.className = 'deck-editor-lightbox-asset-thumb';
        const previewUrl = previewUrls.get(asset.id);
        if (previewUrl) {
          preview.style.backgroundImage = `url("${previewUrl}")`;
        } else {
          preview.textContent = asset.label;
        }
        const label = document.createElement('div');
        label.className = 'deck-editor-card-subtitle';
        label.textContent = asset.label;
        item.append(preview, label);
        item.addEventListener('click', () => onAssign(asset.id));
        row.append(item);
        if (canDelete(asset.id)) {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'deck-editor-asset-remove';
          remove.textContent = 'x';
          remove.addEventListener('click', () => onDelete(asset.id));
          row.append(remove);
        }
        this.lightboxAssetList.appendChild(row);
      });
  }

  private getFolderLabel(folder: AssetFolder): string {
    if (folder.id === 'root-folder') {
      return t('folder.allAssets');
    }
    if (folder.id === 'builtin-waite-folder') {
      return t('folder.waiteTarot');
    }
    return folder.name;
  }
}
