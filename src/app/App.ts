import { Application, Container, Graphics } from 'pixi.js';
import { AssetPreviewManager } from '../assets/AssetPreviewManager';
import { CARD_HEIGHT, CARD_WIDTH, type CardModel } from '../card/CardModel';
import { AssetManager } from '../assets/AssetManager';
import { getCardDisplaySize } from '../card/CardSizing';
import { InputManager } from '../core/InputManager';
import { DeckManager } from '../deck/DeckManager';
import {
  createBuiltinDefaultAssignments,
  createBuiltinDefaultFrontAssets,
  createDefaultBackAssetBundle,
  createSamplePresetBundle,
  isBuiltinAssetId,
} from '../deck/SamplePresetFactory';
import type { AssetFolder, AssetRecord, DeckPreset, PresetBaseMode, SpawnDeckMode } from '../deck/DeckTypes';
import { hasExceededDragThreshold } from '../interaction/ClickOrDrag';
import { BoxSelect } from '../interaction/BoxSelect';
import { DragController } from '../interaction/DragController';
import { BUILTIN_WAITE_FOLDER_ID, PresetStorage, ROOT_FOLDER_ID } from '../storage/PresetStorage';
import {
  blobToDataUrl,
  createTarotPackAssetPath,
  createTarotPackFilename,
  createTarotPackBlob,
  createTarotPackShareText,
  parseTarotPackDataUrl,
  parseTarotPackFile,
  type TarotPackAssetEntry,
} from '../storage/TransferFormats';
import { getTemplatesForMode } from '../tarot/TarotTemplate';
import { Camera2D } from '../table/Camera2D';
import { SelectionManager } from '../table/SelectionManager';
import { TableWorld } from '../table/TableWorld';
import { BottomFanView } from '../ui/BottomFanView';
import { ControlPanel } from '../ui/ControlPanel';
import { DeckEditorOverlay, type DeckEditorDraft, type PreviewCardItem } from '../ui/DeckEditorOverlay';
import { setLanguagePreference, subscribeI18n, t } from '../i18n';

type PointerMode =
  | 'idle'
  | 'panning'
  | 'pilePending'
  | 'pileDrag'
  | 'tableCardPending'
  | 'tableCardDrag'
  | 'handPending'
  | 'handDrag'
  | 'boxSelect';

interface PointerState {
  mode: PointerMode;
  button: number;
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  lastScreenY: number;
  targetPileInstanceId: string | null;
  targetCard: CardModel | null;
}

interface JumperFlightAnimation {
  cardId: string;
  startAt: number;
  durationMs: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  liftHeight: number;
}

interface DeckPileThrowAnimation {
  instanceId: string;
  startAt: number;
  durationMs: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  liftHeight: number;
  rotation: number;
}

const DRAG_THRESHOLD = 14;
const RETURN_ZONE_HEIGHT = 112;

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createAssetLabel(filename: string, id: string): string {
  const trimmed = filename.trim();
  const withoutExtension = trimmed.replace(/\.[^.]+$/, '').trim();
  return withoutExtension || trimmed || id || 'Unnamed Asset';
}

function fileToAsset(file: File, kind: 'front' | 'back'): { asset: AssetRecord; blob: Blob } {
  const id = createId('asset');
  return {
    asset: {
      id,
      filename: file.name,
      label: createAssetLabel(file.name, id),
      kind,
      folderId: 'root-folder',
    },
    blob: file,
  };
}

export class TarotApp {
  // Screen-space overlay/UI lives in uiLayer. World-space table content lives in worldLayer.
  // Camera pan only affects worldLayer positioning via TableWorld/Camera2D.
  private readonly pixi = new Application();
  private readonly camera = new Camera2D();
  private readonly deck = new DeckManager();
  private readonly selection = new SelectionManager();
  private readonly dragController = new DragController();
  private readonly boxSelect = new BoxSelect();
  private readonly storage = new PresetStorage();
  private readonly assets = new AssetManager(this.storage);
  private readonly previews = new AssetPreviewManager(this.storage);
  private readonly controls = new ControlPanel();
  private readonly editor = new DeckEditorOverlay();
  private readonly world = new TableWorld(this.camera);
  private readonly hand = new BottomFanView();
  private readonly uiLayer = new Container();
  private readonly worldLayer = new Container();
  private readonly selectionOverlay = new Graphics();
  private readonly returnZoneOverlay = new Graphics();
  private inputManager: InputManager | null = null;
  private assetsLibrary: AssetRecord[] = [];
  private folders: AssetFolder[] = [];
  private defaultBackAssetId = 'default-back-asset';
  private selectedPresetId: string | null = null;
  private editorPresetId: string | null = null;
  private editorMode: PresetBaseMode = 'full78';
  private editorSelectedCardId: string | null = null;
  private selectedFolderId: string | null = 'root-folder';
  private exportDownloadUrl = '';
  private editorDraft: DeckEditorDraft = {
    id: null,
    name: '',
    backAssetId: 'default-back-asset',
    assignments: createBuiltinDefaultAssignments(),
    extraCards: [],
  };
  private pointer: PointerState = {
    mode: 'idle',
    button: -1,
    startScreenX: 0,
    startScreenY: 0,
    lastScreenX: 0,
    lastScreenY: 0,
    targetPileInstanceId: null,
    targetCard: null,
  };
  private draggingIds = new Set<string>();
  private readonly jumperFlights = new Map<string, JumperFlightAnimation>();
  private readonly pileThrowAnimations = new Map<string, DeckPileThrowAnimation>();
  private hoveredHandCardId: string | null = null;
  private handInsertionIndex: number | null = null;
  private tableFeltVisible = true;
  private editorNameComposing = false;
  private editorPresetNameComposing = false;
  private editorSearchComposing = false;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private viewportFrame = 0;

  constructor(private readonly root: HTMLElement) {}

  async init(): Promise<void> {
    this.syncViewportState(false);
    await this.pixi.init({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: true,
    });

    this.root.appendChild(this.pixi.canvas);
    this.root.appendChild(this.controls.element);
    this.root.appendChild(this.editor.element);
    subscribeI18n(() => {
      this.deck.refreshLocalizedTitles();
      this.editor.applyTranslations();
      this.render();
      this.refreshEditorUi();
    });
    this.pixi.stage.sortableChildren = true;
    this.worldLayer.sortableChildren = true;
    this.uiLayer.sortableChildren = true;
    this.pixi.stage.addChild(this.worldLayer, this.uiLayer);
    this.worldLayer.addChild(this.world.root);
    this.uiLayer.addChild(this.returnZoneOverlay, this.hand.root, this.selectionOverlay);
    this.world.setFeltVisible(this.tableFeltVisible);

    this.controls.shuffleButton.addEventListener('click', () => {
      const activeInstance = this.deck.getActiveInstance();
      if (!activeInstance) {
        return;
      }
      if (this.isShuffleLocked(activeInstance.id)) {
        return;
      }
      this.clearJumperFlightsForInstance(activeInstance.id);
      this.deck.beginShuffle(activeInstance.id, performance.now());
      this.selection.clear(this.deck.getAllCards());
      this.draggingIds.clear();
      this.hoveredHandCardId = null;
      this.handInsertionIndex = null;
      this.render();
    });
    this.controls.spreadButton.addEventListener('click', () => {
      const activeInstance = this.deck.getActiveInstance();
      if (!activeInstance || this.isShuffleLocked(activeInstance.id)) {
        return;
      }
      this.deck.spreadInstance(activeInstance.id);
      this.hoveredHandCardId = null;
      this.handInsertionIndex = null;
      this.render();
    });
    this.controls.returnButton.addEventListener('click', () => {
      const selected = this.selection.getSelected(this.deck.getAllTableCards());
      this.deck.returnCardsToDeck(selected);
      this.draggingIds.clear();
      this.render();
    });
    this.controls.openEditorButton.addEventListener('click', () => {
      this.editor.open();
      void this.syncEditorOverlay();
    });
    this.controls.spawnButton.addEventListener('click', () => {
      void this.handleSpawnDeck(this.controls.getSelectedPresetId(), this.controls.getSelectedMode());
    });
    this.controls.deletePresetButton.addEventListener('click', () => {
      void this.handleDeletePreset(this.controls.getSelectedPresetId());
    });
    this.editor.exportDeckButton.addEventListener('click', () => {
      this.editor.openExportModal();
      void this.handleExportDeck(this.editor.getSelectedPresetId() ?? this.editorPresetId ?? this.selectedPresetId);
    });
    this.editor.importDeckButton.addEventListener('click', () => {
      this.editor.openImportModal();
    });
    this.editor.exportModalCloseButton.addEventListener('click', () => this.editor.closeExportModal());
    this.editor.importModalCloseButton.addEventListener('click', () => this.editor.closeImportModal());
    this.editor.importFileButton.addEventListener('click', () => {
      this.editor.triggerDeckImport();
    });
    this.editor.copyExportTextButton.addEventListener('click', () => {
      void this.handleCopyExportText();
    });
    this.editor.importTextButton.addEventListener('click', () => {
      void this.handleImportPackText();
    });
    this.editor.deckImportInput.addEventListener('change', () => {
      void this.handleImportDeck();
    });
    this.controls.activateInstanceButton.addEventListener('click', () => {
      const instanceId = this.controls.getSelectedInstanceId();
      if (!instanceId) {
        return;
      }
      this.deck.setActiveInstance(instanceId);
      this.controls.setSelectedInstanceId(instanceId);
      this.controls.jumperToggle.checked = this.deck.getActiveInstance()?.jumperEnabled ?? this.controls.jumperToggle.checked;
      this.render();
    });
    this.controls.removeInstanceButton.addEventListener('click', () => {
      void this.handleRemoveInstance(this.deck.getActiveInstance()?.id ?? null);
    });
    this.controls.presetSelect.addEventListener('change', () => {
      this.selectedPresetId = this.controls.getSelectedPresetId();
      this.render();
    });
    this.controls.modeSelect.addEventListener('change', () => {
      this.controls.setSelectedSpawnMode(this.controls.getSelectedMode());
    });
    this.controls.languageSelect.addEventListener('change', () => {
      setLanguagePreference(this.controls.getSelectedLanguage());
    });
    this.controls.instanceSelect.addEventListener('change', () => {
      this.controls.setSelectedInstanceId(this.controls.instanceSelect.value || null);
    });
    this.controls.jumperToggle.addEventListener('change', () => {
      const activeInstance = this.deck.getActiveInstance();
      if (!activeInstance) {
        return;
      }
      this.deck.setJumperEnabled(activeInstance.id, this.controls.isJumperEnabled());
    });
    this.controls.tableFeltToggle.addEventListener('change', () => {
      this.tableFeltVisible = this.controls.isTableFeltVisible();
      this.world.setFeltVisible(this.tableFeltVisible);
      this.render();
    });
    this.editor.closeButton.addEventListener('click', () => this.editor.close());
    this.editor.presetSelect.addEventListener('change', () => {
      this.loadEditorPreset(this.editor.getSelectedPresetId());
    });
    this.editor.new22Button.addEventListener('click', () => {
      void this.createAndSavePreset('major22');
    });
    this.editor.new78Button.addEventListener('click', () => {
      void this.createAndSavePreset('full78');
    });
    this.editor.importAssetsButton.addEventListener('click', () => {
      this.editor.triggerAssetImport();
    });
    this.editor.replaceBackButton.addEventListener('click', () => {
      this.editor.triggerBackImport();
    });
    this.editor.addExtraCardButton.addEventListener('click', () => {
      this.handleAddExtraCard();
    });
    this.editor.assetInput.addEventListener('change', () => {
      void this.handleAssetImport();
    });
    this.editor.backInput.addEventListener('change', () => {
      void this.handleBackImport();
    });
    this.editor.createFolderButton.addEventListener('click', () => {
      void this.handleCreateFolder();
    });
    this.editor.folderSelect.addEventListener('change', () => {
      this.selectedFolderId = this.editor.getSelectedFolderId();
      void this.syncEditorOverlay();
    });
    this.editor.presetNameInput.addEventListener('compositionstart', () => {
      this.editorPresetNameComposing = true;
    });
    this.editor.presetNameInput.addEventListener('compositionend', () => {
      this.editorPresetNameComposing = false;
      void this.handleEditorPresetNameInput();
    });
    this.editor.presetNameInput.addEventListener('input', () => {
      if (this.editorPresetNameComposing) {
        return;
      }
      void this.handleEditorPresetNameInput();
    });
    this.editor.searchInput.addEventListener('input', () => {
      if (this.editorSearchComposing) {
        return;
      }
      void this.syncEditorOverlay();
    });
    this.editor.searchInput.addEventListener('compositionstart', () => {
      this.editorSearchComposing = true;
    });
    this.editor.searchInput.addEventListener('compositionend', () => {
      this.editorSearchComposing = false;
      void this.syncEditorOverlay();
    });
    this.editor.lightboxNameInput.addEventListener('compositionstart', () => {
      this.editorNameComposing = true;
    });
    this.editor.lightboxNameInput.addEventListener('compositionend', () => {
      this.editorNameComposing = false;
      void this.handleEditorCardNameChange();
    });
    this.editor.lightboxNameInput.addEventListener('input', () => {
      if (this.editorNameComposing) {
        return;
      }
      void this.handleEditorCardNameChange();
    });
    this.editor.lightboxNameInput.addEventListener('change', () => {
      void this.handleEditorCardNameChange();
    });
    this.editor.clearAssignmentButton.addEventListener('click', () => {
      void this.handleClearAssignment();
    });
    this.editor.lightboxClearButton.addEventListener('click', () => {
      void this.handleClearAssignment();
    });
    this.editor.lightboxDeleteButton.addEventListener('click', () => {
      void this.handleDeleteExtraCard();
    });
    this.editor.lightboxPrevButton.addEventListener('click', () => {
      this.stepEditorPreviewCard(-1);
    });
    this.editor.lightboxNextButton.addEventListener('click', () => {
      this.stepEditorPreviewCard(1);
    });
    this.editor.resetMaterialsButton.addEventListener('click', () => {
      this.handleResetAllMaterials();
    });
    this.editor.saveButton.addEventListener('click', () => {
      void this.handleSavePreset();
    });
    this.editor.deletePresetButton.addEventListener('click', () => {
      void this.handleDeletePreset(this.editor.getSelectedPresetId() ?? this.editorDraft.id);
    });

    await this.restoreState();
    this.camera.x = this.viewportWidth * 0.5;
    this.camera.y = this.viewportHeight * 0.5 - (this.isMobileViewport() ? 72 : 160);
    this.inputManager = new InputManager(this.pixi.canvas as HTMLCanvasElement, {
      onPointerDown: this.onPointerDown,
      onPointerMove: this.onPointerMove,
      onPointerUp: this.onPointerUp,
      onWheel: this.onWheel,
      onGestureStart: this.onGestureStart,
      onPinch: this.onPinch,
      onGestureEnd: this.onGestureEnd,
    });
    this.inputManager.attach();
    this.pixi.ticker.add(this.onTick);
    window.addEventListener('resize', this.scheduleViewportSync);
    window.addEventListener('orientationchange', this.scheduleViewportSync);
    window.visualViewport?.addEventListener('resize', this.scheduleViewportSync);
    window.screen.orientation?.addEventListener('change', this.scheduleViewportSync);
    this.render();
  }

  private readonly onTick = (): void => {
    const now = performance.now();
    let changed = false;
    if (this.deck.tick(now)) {
      // Deferred world placement keeps shuffle finalization in DeckManager focused on deck state,
      // while App owns the world-space landing position derived from the current camera/viewport.
      this.placePendingAutoJumpers(now);
      changed = true;
    }
    if (this.tickJumperFlights(now)) {
      changed = true;
    }
    if (this.tickPileThrowAnimations(now)) {
      changed = true;
    }
    if (changed || this.deck.getActiveInstance()?.animation) {
      this.render();
    }
  };

  private readonly render = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const activeInstance = this.deck.getActiveInstance();
    const animation = activeInstance?.animation;
    const progress = animation ? Math.min((performance.now() - animation.startAt) / animation.durationMs, 1) : 0;

    // Bottom pile/fan are viewport-space visuals and must not be affected by camera pan.
    this.hand.sync(
      this.deck.getBottomCards(activeInstance?.id ?? null),
      width,
      height,
      this.assets.getTexture.bind(this.assets),
      activeInstance?.flowState === 'shuffling',
      progress,
      this.hoveredHandCardId,
      this.handInsertionIndex,
    );
    // Table cards are world-space objects. Selection box remains a screen-space overlay.
    this.world.sync(this.deck.getAllTableCards(), this.getRenderedTablePiles(), this.assets.getTexture.bind(this.assets), this.draggingIds);
    this.drawReturnZone(width, height);
    this.drawSelectionOverlay();
    this.syncControls();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const { x: screenX, y: screenY } = this.getCanvasPoint(event);
    this.pointer = {
      mode: 'idle',
      button: event.button,
      startScreenX: screenX,
      startScreenY: screenY,
      lastScreenX: screenX,
      lastScreenY: screenY,
      targetPileInstanceId: null,
      targetCard: null,
    };

    if (event.button === 2) {
      // Right mouse is reserved for world panning, regardless of what is under the pointer.
      this.pointer.mode = 'panning';
      return;
    }
    if (event.button !== 0) {
      return;
    }

    const pileInstanceId = this.world.getDeckPileAt(screenX, screenY);
    if (pileInstanceId) {
      this.pointer.mode = 'pilePending';
      this.pointer.targetPileInstanceId = pileInstanceId;
      return;
    }

    const tableCard = this.getTableCardAt(screenX, screenY);
    if (tableCard) {
      this.hoveredHandCardId = null;
      this.handInsertionIndex = null;
      this.pointer.mode = 'tableCardPending';
      this.pointer.targetCard = tableCard;
      if (!tableCard.selected) {
        this.selection.setSingle(this.deck.getAllTableCards(), tableCard);
      }
      this.render();
      return;
    }

    // Only the active deck is rendered in the bottom viewport area. Table cards may belong to any deck instance.
    const handCard = this.hand.getCardAt(screenX, screenY, this.deck.getBottomCards(this.deck.getActiveInstance()?.id ?? null));
    if (handCard) {
      this.pointer.mode = 'handPending';
      this.pointer.targetCard = handCard;
      this.hoveredHandCardId = handCard.id;
      return;
    }

    if (event.pointerType === 'touch') {
      // A single finger on empty felt pans the world. Desktop keeps drag-box selection.
      this.pointer.mode = 'panning';
      return;
    }

    this.pointer.mode = 'boxSelect';
    // Box selection intentionally applies only to table cards, never bottom-area cards.
    this.hoveredHandCardId = null;
    this.handInsertionIndex = null;
    this.selection.clear(this.deck.getAllTableCards());
    this.boxSelect.begin(screenX, screenY);
    this.render();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const { x: screenX, y: screenY } = this.getCanvasPoint(event);
    const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.camera.zoomAt(screenX, screenY, zoomFactor);
    this.render();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const { x: screenX, y: screenY } = this.getCanvasPoint(event);
    const deltaX = screenX - this.pointer.lastScreenX;
    const deltaY = screenY - this.pointer.lastScreenY;
    this.pointer.lastScreenX = screenX;
    this.pointer.lastScreenY = screenY;

    if (this.pointer.mode === 'panning') {
      this.camera.pan(deltaX, deltaY);
      this.render();
      return;
    }

    if (this.pointer.mode === 'pilePending' && this.pointer.targetPileInstanceId) {
      if (!hasExceededDragThreshold(this.pointer.startScreenX, this.pointer.startScreenY, screenX, screenY, DRAG_THRESHOLD)) {
        return;
      }
      this.pointer.mode = 'pileDrag';
      this.pileThrowAnimations.delete(this.pointer.targetPileInstanceId);
    }

    if (this.pointer.mode === 'pileDrag' && this.pointer.targetPileInstanceId) {
      const worldPoint = this.camera.screenToWorld(screenX, screenY);
      this.deck.setPilePosition(this.pointer.targetPileInstanceId, worldPoint.x, worldPoint.y);
      this.render();
      return;
    }

    if (this.pointer.mode === 'tableCardPending' && this.pointer.targetCard) {
      if (!hasExceededDragThreshold(this.pointer.startScreenX, this.pointer.startScreenY, screenX, screenY, DRAG_THRESHOLD)) {
        return;
      }
      this.pointer.mode = 'tableCardDrag';
      const selected = this.getActiveDragCards(this.pointer.targetCard);
      this.draggingIds = new Set(selected.map((card) => card.id));
      this.dragController.begin(selected);
    }

    if (this.pointer.mode === 'tableCardDrag' && this.pointer.targetCard) {
      const moved = this.getActiveDragCards(this.pointer.targetCard);
      const totalDx = (screenX - this.pointer.startScreenX) / this.camera.zoom;
      const totalDy = (screenY - this.pointer.startScreenY) / this.camera.zoom;
      for (const card of moved) {
        const anchor = this.dragController.getAnchor(card);
        if (!anchor) {
          continue;
        }
        card.x = anchor.startX + totalDx;
        card.y = anchor.startY + totalDy;
      }
      this.updateHandInsertionPreview(screenX, screenY, moved);
      this.render();
      return;
    }

    if (this.pointer.mode === 'handPending' && this.pointer.targetCard) {
      if (!hasExceededDragThreshold(this.pointer.startScreenX, this.pointer.startScreenY, screenX, screenY, DRAG_THRESHOLD)) {
        return;
      }
      this.pointer.mode = 'handDrag';
      const worldPoint = this.camera.screenToWorld(screenX, screenY);
      // Pulling from the bottom area promotes the card into world-space table state.
      this.pointer.targetCard.zone = 'table';
      this.pointer.targetCard.faceUp = false;
      this.pointer.targetCard.selected = true;
      this.selection.setSingle(this.deck.getAllTableCards(), this.pointer.targetCard);
      this.pointer.targetCard.x = worldPoint.x;
      this.pointer.targetCard.y = worldPoint.y;
      this.draggingIds = new Set([this.pointer.targetCard.id]);
      this.dragController.begin([this.pointer.targetCard]);
      this.hoveredHandCardId = null;
      this.render();
      return;
    }

    if (this.pointer.mode === 'handDrag' && this.pointer.targetCard) {
      const worldPoint = this.camera.screenToWorld(screenX, screenY);
      this.pointer.targetCard.x = worldPoint.x;
      this.pointer.targetCard.y = worldPoint.y;
      this.render();
      return;
    }

    if (this.pointer.mode === 'boxSelect') {
      this.boxSelect.update(screenX, screenY);
      const ids = this.getCardsInSelectionBox();
      this.selection.selectFromSet(this.deck.getAllTableCards(), ids);
      this.render();
      return;
    }

    this.updateHandHover(screenX, screenY);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointer.mode === 'panning') {
      this.resetPointer();
      return;
    }
    if (event.button !== 0) {
      this.resetPointer();
      return;
    }
    if (this.pointer.mode === 'pilePending' && this.pointer.targetPileInstanceId) {
      this.activateDeckPile(this.pointer.targetPileInstanceId, this.pointer.lastScreenX, this.pointer.lastScreenY);
      this.resetPointer();
      return;
    }
    if (this.pointer.mode === 'tableCardPending' && this.pointer.targetCard) {
      this.pointer.targetCard.faceUp = !this.pointer.targetCard.faceUp;
    }
    if (this.pointer.mode === 'tableCardDrag' && this.pointer.targetCard) {
      const draggedCards = this.getActiveDragCards(this.pointer.targetCard);
      if (this.isInReturnZone(this.pointer.lastScreenX, this.pointer.lastScreenY)) {
        if (!this.tryInsertDraggedCardsIntoHand(draggedCards, this.pointer.lastScreenX, this.pointer.lastScreenY)) {
          this.deck.returnCardsToDeck(draggedCards);
        }
      }
    }
    if (this.pointer.mode === 'boxSelect') {
      this.boxSelect.reset();
    }
    this.dragController.reset();
    this.draggingIds.clear();
    this.handInsertionIndex = null;
    const finalX = this.pointer.lastScreenX;
    const finalY = this.pointer.lastScreenY;
    this.resetPointer();
    this.updateHandHover(finalX, finalY);
    this.render();
  };

  private readonly onGestureStart = (): void => {
    this.boxSelect.reset();
    this.dragController.reset();
    this.draggingIds.clear();
    this.handInsertionIndex = null;
    this.resetPointer();
    this.render();
  };

  private readonly onPinch = (gesture: { centerX: number; centerY: number; deltaX: number; deltaY: number; scaleFactor: number }): void => {
    const canvas = this.pixi.canvas as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const centerX = gesture.centerX - rect.left;
    const centerY = gesture.centerY - rect.top;
    this.camera.pan(gesture.deltaX, gesture.deltaY);
    this.camera.zoomAt(centerX, centerY, gesture.scaleFactor);
    this.render();
  };

  private readonly onGestureEnd = (): void => {
    this.resetPointer();
    this.render();
  };

  private readonly scheduleViewportSync = (): void => {
    if (this.viewportFrame) {
      cancelAnimationFrame(this.viewportFrame);
    }
    this.viewportFrame = requestAnimationFrame(() => {
      this.viewportFrame = 0;
      this.syncViewportState(true);
      this.render();
    });
  };

  private syncViewportState(preserveWorldCenter: boolean): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    if (preserveWorldCenter && this.viewportWidth > 0 && this.viewportHeight > 0) {
      const worldCenterX = (this.viewportWidth * 0.5 - this.camera.x) / this.camera.zoom;
      const worldCenterY = (this.viewportHeight * 0.5 - this.camera.y) / this.camera.zoom;
      this.camera.x = width * 0.5 - worldCenterX * this.camera.zoom;
      this.camera.y = height * 0.5 - worldCenterY * this.camera.zoom;
    }
    this.viewportWidth = width;
    this.viewportHeight = height;

    const orientation = width >= height ? 'landscape' : 'portrait';
    const mobile = this.isMobileViewport(width, height);
    document.documentElement.dataset.orientation = orientation;
    document.documentElement.dataset.mobile = String(mobile);
    document.documentElement.style.setProperty('--app-width', `${width}px`);
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    this.root.dataset.orientation = orientation;
    this.root.dataset.mobile = String(mobile);
    this.controls.setMobileMode(mobile);
    this.resetPointer();
  }

  private isMobileViewport(width = window.innerWidth, height = window.innerHeight): boolean {
    return window.matchMedia('(pointer: coarse)').matches || width <= 820 || (width <= 1024 && height <= 600);
  }

  private async restoreState(): Promise<void> {
    await this.ensureBuiltinDefaultAssets();
    let presets = await this.storage.getPresets();
    this.assetsLibrary = await this.storage.getAssets();
    this.folders = await this.storage.getFolders();

    if (presets.length === 0) {
      const sample = await createSamplePresetBundle();
      await this.storage.saveAssets(sample.assets);
      await this.storage.savePreset(sample.preset);
      presets = [sample.preset];
      this.assetsLibrary = await this.storage.getAssets();
    }

    let normalizedPresetsChanged = false;
    presets = presets.map((preset) => {
      if (preset.backAssetId) {
        return preset;
      }
      normalizedPresetsChanged = true;
      return {
        ...preset,
        backAssetId: this.defaultBackAssetId,
      };
    });
    if (normalizedPresetsChanged) {
      for (const preset of presets) {
        await this.storage.savePreset(preset);
      }
    }

    this.deck.loadPresets(presets);
    this.selectedPresetId = presets[0]?.id ?? null;
    this.loadEditorPreset(this.selectedPresetId);
    if (this.selectedPresetId) {
      await this.handleSpawnDeck(this.selectedPresetId, 'full78');
    }
  }

  private async handleAssetImport(): Promise<void> {
    const files = this.editor.getImportedAssets();
    if (files.length === 0) {
      return;
    }
    const assets = files.map((file) => {
      const asset = fileToAsset(file, 'front');
      asset.asset.folderId = this.selectedFolderId ?? 'root-folder';
      return asset;
    });
    await this.storage.saveAssets(assets);
    this.assetsLibrary = await this.storage.getAssets();
    this.editor.clearImports();
    this.editor.setStatus(t('msg.importedFrontAssets', { count: assets.length }));
    this.render();
    this.refreshEditorUi();
  }

  private async handleBackImport(): Promise<void> {
    const file = this.editor.getBackFile();
    if (!file) {
      return;
    }
    const previousBackAssetId = this.editorDraft.backAssetId;
    const asset = fileToAsset(file, 'back');
    asset.asset.folderId = this.selectedFolderId ?? 'root-folder';
    await this.storage.saveAssets([asset]);
    this.assetsLibrary = await this.storage.getAssets();
    this.editorDraft.backAssetId = asset.asset.id;
    if (this.editorDraft.id) {
      const existingPreset = this.deck.getPreset(this.editorDraft.id);
      if (existingPreset) {
        const affectedInstanceCount = this.deck.getInstances().filter((instance) => instance.presetId === existingPreset.id).length;
        if (affectedInstanceCount > 0) {
          await this.assets.acquireAssets(Array.from({ length: affectedInstanceCount }, () => asset.asset.id));
        }
        const updatedPreset: DeckPreset = {
          ...existingPreset,
          name: this.editorDraft.name || existingPreset.name,
          baseMode: this.editorMode,
          backAssetId: asset.asset.id,
          assignments: { ...this.editorDraft.assignments },
          extraCards: [...this.editorDraft.extraCards],
          updatedAt: Date.now(),
        };
        await this.storage.savePreset(updatedPreset);
        this.deck.updatePresetBackAsset(updatedPreset.id, updatedPreset.backAssetId);
        this.deck.upsertPreset(updatedPreset);
        if (previousBackAssetId && previousBackAssetId !== asset.asset.id && affectedInstanceCount > 0) {
          this.assets.releaseAssets(Array.from({ length: affectedInstanceCount }, () => previousBackAssetId));
        }
      }
    }
    this.editor.clearImports();
    this.editor.setStatus(t('msg.selectedSharedBackImage', { name: asset.asset.label }));
    this.render();
    this.refreshEditorUi();
  }

  private loadEditorPreset(presetId: string | null): void {
    const preset = presetId ? this.deck.getPreset(presetId) : null;
    this.editorPresetId = presetId;
    this.editorMode = preset?.baseMode ?? 'full78';
    const nextDraft = preset
      ? {
          id: preset.id,
          name: preset.name,
          backAssetId: preset.backAssetId ?? this.defaultBackAssetId,
          assignments: { ...preset.assignments },
          extraCards: [...preset.extraCards],
        }
      : {
          id: null,
          name: '',
          backAssetId: this.defaultBackAssetId,
          assignments: createBuiltinDefaultAssignments(),
          extraCards: [],
        };
    this.editorDraft = nextDraft;
    this.editorSelectedCardId = null;
    this.render();
    this.refreshEditorUi();
  }

  private async handleSavePreset(): Promise<void> {
    this.editorDraft.name = this.editor.presetNameInput.value.trim();
    if (!this.editorDraft.name) {
      this.editor.setStatus(t('msg.presetNameRequired'));
      return;
    }
    const preset = await this.persistEditorDraft();
    if (!preset) {
      return;
    }
    this.editor.setStatus(t('msg.savedPreset', { name: preset.name }));
    this.render();
    this.refreshEditorUi();
  }

  private async createAndSavePreset(mode: PresetBaseMode): Promise<void> {
    this.editorMode = mode;
    this.editorSelectedCardId = null;
    const name = this.createUniquePresetName(t('preset.newDefaultName'));
    const preset: DeckPreset = {
      id: createId('preset'),
      name,
      baseMode: mode,
      backAssetId: this.defaultBackAssetId,
      assignments: createBuiltinDefaultAssignments(),
      extraCards: [],
      updatedAt: Date.now(),
    };
    await this.storage.savePreset(preset);
    this.deck.upsertPreset(preset);
    this.selectedPresetId = preset.id;
    this.editorPresetId = preset.id;
    this.editorDraft = {
      id: preset.id,
      name: preset.name,
      backAssetId: preset.backAssetId,
      assignments: { ...preset.assignments },
      extraCards: [],
    };
    this.editor.open();
    this.editor.setStatus(t('msg.savedPreset', { name: preset.name }));
    this.render();
    this.refreshEditorUi();
  }

  private async handleSpawnDeck(presetId: string | null, mode: SpawnDeckMode): Promise<void> {
    if (!presetId) {
      this.editor.setStatus(t('msg.selectPresetBeforeSpawn'));
      return;
    }
    const allowedModes = this.deck.getAllowedSpawnModes(presetId);
    if (!allowedModes.includes(mode)) {
      this.controls.setSelectedSpawnMode(allowedModes[0] ?? 'major22');
      return;
    }
    // Cards/presets only carry asset ids. Texture ownership stays centralized in AssetManager.
    await this.assets.acquireAssets(this.deck.getPresetAssetIds(presetId));
    const instance = this.deck.createInstance(presetId, mode, this.controls.isJumperEnabled());
    this.deck.setActiveInstance(instance.id);
    this.selectedPresetId = presetId;
    this.controls.setSelectedInstanceId(instance.id);
    this.controls.jumperToggle.checked = this.deck.getActiveInstance()?.jumperEnabled ?? this.controls.jumperToggle.checked;
    this.render();
  }

  private async handleDeletePreset(presetId: string | null): Promise<void> {
    if (!presetId) {
      return;
    }
    const assetIds = this.deck.getPresetAssetIds(presetId);
    const removedInstances = this.deck.removePreset(presetId);
    this.assets.releaseAssets(assetIds.flatMap((id) => removedInstances.map(() => id)));
    await this.storage.deletePreset(presetId);
    this.selectedPresetId = this.deck.getPresets()[0]?.id ?? null;
    this.loadEditorPreset(this.selectedPresetId);
    this.selection.clear(this.deck.getAllCards());
    this.render();
  }

  private async handleRemoveInstance(instanceId: string | null): Promise<void> {
    if (!instanceId) {
      return;
    }
    const instance = this.deck.getInstances().find((entry) => entry.id === instanceId);
    const removed = this.deck.removeInstance(instanceId);
    if (!removed || !instance) {
      return;
    }
    this.assets.releaseAssets(this.deck.getPresetAssetIds(instance.presetId));
    this.selection.clear(this.deck.getAllCards());
    this.render();
  }

  private resetPointer(): void {
    this.pointer = {
      mode: 'idle',
      button: -1,
      startScreenX: 0,
      startScreenY: 0,
      lastScreenX: 0,
      lastScreenY: 0,
      targetPileInstanceId: null,
      targetCard: null,
    };
  }

  private getCanvasPoint(event: MouseEvent): { x: number; y: number } {
    const rect = (this.pixi.canvas as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private getActiveDragCards(target: CardModel): CardModel[] {
    const selected = this.selection.getSelected(this.deck.getAllTableCards());
    if (target.selected && selected.length > 1) {
      return selected;
    }
    return [target];
  }

  private activateDeckPile(instanceId: string, screenX: number, screenY: number): void {
    const activeInstance = this.deck.getActiveInstance();
    if (activeInstance && activeInstance.id !== instanceId) {
      this.clearJumperFlightsForInstance(activeInstance.id);
      this.pileThrowAnimations.delete(activeInstance.id);
      const dropPoint = this.camera.screenToWorld(screenX - 140, screenY + 90);
      const startPoint = this.camera.screenToWorld(window.innerWidth * 0.5, window.innerHeight - 108);
      this.deck.stackInstanceToTablePile(activeInstance.id, dropPoint.x, dropPoint.y);
      this.pileThrowAnimations.set(activeInstance.id, {
        instanceId: activeInstance.id,
        startAt: performance.now(),
        durationMs: 380,
        startX: startPoint.x,
        startY: startPoint.y,
        endX: dropPoint.x,
        endY: dropPoint.y,
        liftHeight: 92,
        rotation: (Math.random() - 0.5) * 0.24,
      });
    }
    this.deck.setActiveInstance(instanceId);
    this.controls.setSelectedInstanceId(instanceId);
    this.controls.jumperToggle.checked = this.deck.getActiveInstance()?.jumperEnabled ?? this.controls.jumperToggle.checked;
    this.render();
  }

  private getTableCardAt(screenX: number, screenY: number): CardModel | null {
    const cards = [...this.deck.getAllTableCards()];
    cards.sort((a, b) => {
      const az = (a.selected ? 1000 : 0) + a.instanceOrder * 1000 + a.deckIndex;
      const bz = (b.selected ? 1000 : 0) + b.instanceOrder * 1000 + b.deckIndex;
      return az - bz;
    });
    for (let index = cards.length - 1; index >= 0; index -= 1) {
      const card = cards[index];
      const screen = this.camera.worldToScreen(card.x, card.y);
      const size = this.getRenderedCardSize(card);
      const width = size.width * this.camera.zoom;
      const height = size.height * this.camera.zoom;
      const left = screen.x - width / 2;
      const top = screen.y - height / 2;
      const inside = screenX >= left && screenX <= left + width && screenY >= top && screenY <= top + height;
      if (inside) {
        return card;
      }
    }
    return null;
  }

  private getCardsInSelectionBox(): Set<string> {
    const rect = this.boxSelect.getRect();
    const ids = new Set<string>();
    for (const card of this.deck.getAllTableCards()) {
      const screen = this.camera.worldToScreen(card.x, card.y);
      const size = this.getRenderedCardSize(card);
      const width = size.width * this.camera.zoom;
      const height = size.height * this.camera.zoom;
      const left = screen.x - width / 2;
      const top = screen.y - height / 2;
      const overlaps =
        left < rect.x + rect.width &&
        left + width > rect.x &&
        top < rect.y + rect.height &&
        top + height > rect.y;
      if (overlaps) {
        ids.add(card.id);
      }
    }
    return ids;
  }

  private drawSelectionOverlay(): void {
    this.selectionOverlay.clear();
    if (!this.boxSelect.active) {
      return;
    }
    const rect = this.boxSelect.getRect();
    this.selectionOverlay.rect(rect.x, rect.y, rect.width, rect.height);
    this.selectionOverlay.fill({ color: 0xbda36a, alpha: 0.14 });
    this.selectionOverlay.stroke({ color: 0xf3d892, alpha: 0.92, width: 1.5 });
  }

  private syncControls(): void {
    const presets = this.deck.getPresets();
    if (!this.selectedPresetId || !presets.some((preset) => preset.id === this.selectedPresetId)) {
      this.selectedPresetId = presets[0]?.id ?? null;
    }
    const activeInstance = this.deck.getActiveInstance();
    const allowedSpawnModes: SpawnDeckMode[] = this.selectedPresetId ? this.deck.getAllowedSpawnModes(this.selectedPresetId) : ['major22'];
    this.controls.applyTranslations();
    this.controls.syncPresets(presets, this.selectedPresetId);
    this.controls.syncSpawnModes(allowedSpawnModes);
    this.controls.syncInstances(this.deck.getInstances(), activeInstance?.id ?? null);
    this.controls.jumperToggle.checked = activeInstance?.jumperEnabled ?? this.controls.jumperToggle.checked;
    this.controls.shuffleButton.disabled = activeInstance ? this.isShuffleLocked(activeInstance.id) : true;
    this.controls.spreadButton.disabled = !activeInstance || this.isShuffleLocked(activeInstance.id) || activeInstance.flowState === 'fan';
  }

  private clearJumperFlightsForInstance(instanceId: string): void {
    for (const [cardId] of this.jumperFlights.entries()) {
      const card = this.deck.getAllCards().find((entry) => entry.id === cardId);
      if (!card) {
        this.jumperFlights.delete(cardId);
        continue;
      }
      if (card.deckInstanceId === instanceId) {
        card.pendingAutoPlace = false;
        this.jumperFlights.delete(cardId);
      }
    }
  }

  private isShuffleLocked(instanceId: string): boolean {
    const activeAnimation = this.deck.getInstances().find((instance) => instance.id === instanceId)?.animation;
    if (activeAnimation) {
      return true;
    }
    for (const [cardId] of this.jumperFlights.entries()) {
      const card = this.deck.getAllCards().find((entry) => entry.id === cardId);
      if (card?.deckInstanceId === instanceId) {
        return true;
      }
    }
    return false;
  }

  private placePendingAutoJumpers(now: number): void {
    const jumpers = this.deck
      .getAllTableCards()
      .filter((card) => card.pendingAutoPlace && !this.jumperFlights.has(card.id));
    if (jumpers.length === 0) {
      return;
    }
    // Jumper trigger resolution happens in DeckManager, but the actual landing point belongs to App
    // because it depends on the current camera/viewport relationship between screen space and world space.
    const start = this.camera.screenToWorld(window.innerWidth * 0.5, window.innerHeight - 118);
    const end = this.camera.screenToWorld(window.innerWidth * 0.58, window.innerHeight * 0.4);
    jumpers.forEach((card, index) => {
      const startX = start.x + (index - (jumpers.length - 1) / 2) * 8;
      const startY = start.y - Math.min(index, 2) * 2;
      const laneOffsetX = (index - (jumpers.length - 1) / 2) * 118;
      const laneOffsetY = index * 18;
      const randomOffsetX = (Math.random() - 0.5) * 96;
      const randomOffsetY = (Math.random() - 0.5) * 72;
      const endX = end.x + laneOffsetX + randomOffsetX;
      const endY = end.y + laneOffsetY + randomOffsetY;
      card.x = startX;
      card.y = startY;
      card.selected = false;
      this.jumperFlights.set(card.id, {
        cardId: card.id,
        startAt: now,
        durationMs: 360 + index * 40,
        startX,
        startY,
        endX,
        endY,
        liftHeight: 72 + index * 10 + Math.random() * 18,
      });
    });
  }

  private tickJumperFlights(now: number): boolean {
    if (this.jumperFlights.size === 0) {
      return false;
    }
    let changed = false;
    for (const [cardId, flight] of this.jumperFlights.entries()) {
      const card = this.deck.getAllTableCards().find((entry) => entry.id === cardId);
      if (!card) {
        this.jumperFlights.delete(cardId);
        changed = true;
        continue;
      }
      const progress = Math.min((now - flight.startAt) / flight.durationMs, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      card.x = flight.startX + (flight.endX - flight.startX) * eased;
      card.y = flight.startY + (flight.endY - flight.startY) * eased - Math.sin(progress * Math.PI) * flight.liftHeight;
      changed = true;
      if (progress >= 1) {
        card.x = flight.endX;
        card.y = flight.endY;
        card.pendingAutoPlace = false;
        this.jumperFlights.delete(cardId);
      }
    }
    return changed;
  }

  private getRenderedTablePiles(): Array<{
    instanceId: string;
    x: number;
    y: number;
    count: number;
    backAssetId: string | null;
    label: string;
    rotation?: number;
  }> {
    return this.deck.getTablePiles().map((pile) => {
      const animation = this.pileThrowAnimations.get(pile.instanceId);
      if (!animation) {
        return pile;
      }
      const progress = Math.min((performance.now() - animation.startAt) / animation.durationMs, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      return {
        ...pile,
        x: animation.startX + (animation.endX - animation.startX) * eased,
        y: animation.startY + (animation.endY - animation.startY) * eased - Math.sin(progress * Math.PI) * animation.liftHeight,
        rotation: animation.rotation * Math.sin(progress * Math.PI),
      };
    });
  }

  private tickPileThrowAnimations(now: number): boolean {
    if (this.pileThrowAnimations.size === 0) {
      return false;
    }
    let changed = false;
    for (const [instanceId, animation] of this.pileThrowAnimations.entries()) {
      changed = true;
      if (now >= animation.startAt + animation.durationMs) {
        this.pileThrowAnimations.delete(instanceId);
      }
    }
    return changed;
  }

  private async ensureDefaultBackAsset(): Promise<void> {
    const defaultBack = await createDefaultBackAssetBundle();
    this.defaultBackAssetId = defaultBack.asset.id;
    await this.storage.saveAssets([defaultBack]);
  }

  private async ensureBuiltinDefaultAssets(): Promise<void> {
    await this.ensureDefaultBackAsset();
    await this.storage.saveFolder({
      id: BUILTIN_WAITE_FOLDER_ID,
      name: 'Waite Tarot',
      orderIndex: 1,
    });
    await this.storage.saveAssets(await createBuiltinDefaultFrontAssets());
  }

  private drawReturnZone(viewportWidth: number, viewportHeight: number): void {
    const rect = this.getReturnZoneRect(viewportWidth, viewportHeight);
    this.returnZoneOverlay.clear();
    this.returnZoneOverlay.roundRect(rect.x, rect.y, rect.width, rect.height, 12);
    this.returnZoneOverlay.fill({ color: 0x7e5d22, alpha: this.pointer.mode === 'tableCardDrag' ? 0.2 : 0.08 });
    this.returnZoneOverlay.stroke({ color: 0xe9c777, alpha: 0.65, width: 1.5 });
  }

  private getReturnZoneRect(viewportWidth: number, viewportHeight: number): { x: number; y: number; width: number; height: number } {
    const handBand = this.hand.getHandBandRect();
    if (handBand) {
      return {
        x: handBand.x,
        y: handBand.y - 8,
        width: handBand.width,
        height: handBand.height + 12,
      };
    }
    const compact = viewportWidth <= 820 || (viewportWidth <= 1024 && viewportHeight <= 600);
    return {
      x: compact ? 12 : Math.max(132, viewportWidth * 0.28),
      y: viewportHeight - (compact ? 92 : RETURN_ZONE_HEIGHT),
      width: compact ? viewportWidth - 24 : Math.max(220, viewportWidth - Math.max(264, viewportWidth * 0.56)),
      height: compact ? 80 : RETURN_ZONE_HEIGHT - 12,
    };
  }

  private isInReturnZone(screenX: number, screenY: number): boolean {
    const rect = this.getReturnZoneRect(window.innerWidth, window.innerHeight);
    return screenX >= rect.x && screenX <= rect.x + rect.width && screenY >= rect.y && screenY <= rect.y + rect.height;
  }

  private updateHandHover(screenX: number, screenY: number): void {
    if (this.pointer.mode !== 'idle' && this.pointer.mode !== 'handPending') {
      if (this.hoveredHandCardId !== null) {
        this.hoveredHandCardId = null;
        this.render();
      }
      return;
    }
    const activeBottomCards = this.deck.getBottomCards(this.deck.getActiveInstance()?.id ?? null);
    const hovered = this.hand.getCardAt(screenX, screenY, activeBottomCards);
    const nextId = hovered?.id ?? null;
    if (nextId !== this.hoveredHandCardId) {
      this.hoveredHandCardId = nextId;
      this.render();
    }
  }

  private updateHandInsertionPreview(screenX: number, screenY: number, draggedCards: CardModel[]): void {
    const activeInstance = this.deck.getActiveInstance();
    const sameInstance = draggedCards.length > 0 && draggedCards.every((card) => card.deckInstanceId === draggedCards[0].deckInstanceId);
    if (activeInstance?.flowState === 'pile') {
      this.handInsertionIndex = null;
      this.hoveredHandCardId = null;
      return;
    }
    const canInsertToVisibleHand =
      !!activeInstance &&
      sameInstance &&
      draggedCards[0].deckInstanceId === activeInstance.id &&
      this.isInReturnZone(screenX, screenY) &&
      this.hand.isInsideHandBand(screenX, screenY);

    if (!canInsertToVisibleHand) {
      this.handInsertionIndex = null;
      this.hoveredHandCardId = null;
      return;
    }

    const activeBottomCards = this.deck.getBottomCards(activeInstance.id);
    this.handInsertionIndex = this.hand.getInsertionIndex(screenX, activeBottomCards);
    this.hoveredHandCardId = null;
  }

  private tryInsertDraggedCardsIntoHand(draggedCards: CardModel[], screenX: number, screenY: number): boolean {
    const activeInstance = this.deck.getActiveInstance();
    if (!activeInstance || draggedCards.length === 0) {
      return false;
    }
    const sameInstance = draggedCards.every((card) => card.deckInstanceId === draggedCards[0].deckInstanceId);
    if (!sameInstance || draggedCards[0].deckInstanceId !== activeInstance.id) {
      return false;
    }
    if (!this.hand.isInsideHandBand(screenX, screenY)) {
      return false;
    }
    const insertionIndex =
      this.handInsertionIndex ?? this.hand.getInsertionIndex(screenX, this.deck.getBottomCards(activeInstance.id));
    this.deck.insertCardsIntoHand(activeInstance.id, draggedCards, insertionIndex);
    this.handInsertionIndex = null;
    return true;
  }

  private async handleEditorPresetNameInput(): Promise<void> {
    this.editorDraft.name = this.editor.presetNameInput.value;
    if (!this.editorDraft.name.trim()) {
      return;
    }
    await this.persistEditorDraft();
    this.render();
    this.refreshEditorUi();
  }

  private async handleEditorCardNameChange(): Promise<void> {
    if (!this.editorSelectedCardId) {
      return;
    }
    const customCard = this.editorDraft.extraCards.find((card) => card.id === this.editorSelectedCardId);
    if (customCard) {
      customCard.name = this.editor.lightboxNameInput.value;
      await this.persistEditorDraft();
      this.render();
      this.refreshEditorUi();
    }
  }

  private async handleClearAssignment(): Promise<void> {
    if (!this.editorSelectedCardId) {
      return;
    }
    const customCard = this.editorDraft.extraCards.find((card) => card.id === this.editorSelectedCardId);
    if (customCard) {
      customCard.frontAssetId = null;
      await this.persistEditorDraft();
      this.render();
      this.refreshEditorUi();
      return;
    }
    this.editorDraft.assignments[this.editorSelectedCardId] = createBuiltinDefaultAssignments()[this.editorSelectedCardId] ?? null;
    await this.persistEditorDraft();
    this.render();
    this.refreshEditorUi();
  }

  private handleResetAllMaterials(): void {
    this.editorDraft.backAssetId = this.defaultBackAssetId;
    this.editorDraft.assignments = createBuiltinDefaultAssignments();
    this.editorDraft.extraCards = this.editorDraft.extraCards.map((card, index) => ({
      ...card,
      frontAssetId: null,
      orderIndex: index,
    }));
    this.editor.setStatus(t('msg.resetAllMaterials'));
    this.render();
    this.refreshEditorUi();
  }

  private handleAddExtraCard(): void {
    const extraCard = {
      id: createId('extra-card'),
      name: t('ui.customCardDefaultName', { count: this.editorDraft.extraCards.length + 1 }),
      frontAssetId: null,
      orderIndex: this.editorDraft.extraCards.length,
    };
    this.editorDraft.extraCards = [...this.editorDraft.extraCards, extraCard];
    this.editorSelectedCardId = extraCard.id;
    this.editor.setStatus(t('msg.addedExtraCard', { name: extraCard.name }));
    this.render();
    this.refreshEditorUi();
  }

  private async handleDeleteExtraCard(): Promise<void> {
    if (!this.editorSelectedCardId) {
      return;
    }
    const nextExtraCards = this.editorDraft.extraCards
      .filter((card) => card.id !== this.editorSelectedCardId)
      .map((card, index) => ({
        ...card,
        orderIndex: index,
      }));
    if (nextExtraCards.length === this.editorDraft.extraCards.length) {
      return;
    }
    this.editorDraft.extraCards = nextExtraCards;
    this.editorSelectedCardId = null;
    await this.persistEditorDraft();
    this.editor.closeLightbox();
    this.editor.setStatus(t('msg.deletedCustomCard'));
    this.render();
    this.refreshEditorUi();
  }

  private async assignSelectedEditorAsset(assetId: string): Promise<void> {
    if (!this.editorSelectedCardId) {
      return;
    }
    const custom = this.editorDraft.extraCards.find((card) => card.id === this.editorSelectedCardId);
    if (custom) {
      custom.frontAssetId = assetId;
    } else {
      this.editorDraft.assignments[this.editorSelectedCardId] = assetId;
    }
    await this.persistEditorDraft();
    this.render();
    this.refreshEditorUi();
  }

  private createPresetFromDraft(): DeckPreset {
    return {
      id: this.editorDraft.id ?? createId('preset'),
      name: this.editorDraft.name,
      baseMode: this.editorMode,
      backAssetId: this.editorDraft.backAssetId ?? this.defaultBackAssetId,
      assignments: { ...this.editorDraft.assignments },
      extraCards: this.editorDraft.extraCards.map((card) => ({ ...card })),
      updatedAt: Date.now(),
    };
  }

  private collectPresetAssetIds(preset: DeckPreset): string[] {
    const ids = new Set<string>();
    if (preset.backAssetId) {
      ids.add(preset.backAssetId);
    }
    Object.values(preset.assignments).forEach((assetId) => {
      if (assetId) {
        ids.add(assetId);
      }
    });
    preset.extraCards.forEach((card) => {
      if (card.frontAssetId) {
        ids.add(card.frontAssetId);
      }
    });
    return [...ids];
  }

  private async persistEditorDraft(): Promise<DeckPreset | null> {
    if (!this.editorDraft.name.trim()) {
      return null;
    }

    const previousPreset = this.editorDraft.id ? this.deck.getPreset(this.editorDraft.id) : undefined;
    const nextPreset = this.createPresetFromDraft();
    const affectedInstanceCount = this.deck.getInstances().filter((instance) => instance.presetId === nextPreset.id).length;
    const previousAssetIds = new Set(previousPreset ? this.collectPresetAssetIds(previousPreset) : []);
    const nextAssetIds = new Set(this.collectPresetAssetIds(nextPreset));
    const addedAssetIds = [...nextAssetIds].filter((assetId) => !previousAssetIds.has(assetId));
    const removedAssetIds = [...previousAssetIds].filter((assetId) => !nextAssetIds.has(assetId));

    if (affectedInstanceCount > 0 && addedAssetIds.length > 0) {
      await this.assets.acquireAssets(addedAssetIds.flatMap((assetId) => Array.from({ length: affectedInstanceCount }, () => assetId)));
    }

    await this.storage.savePreset(nextPreset);
    this.deck.upsertPreset(nextPreset);
    this.deck.syncInstancesFromPreset(nextPreset.id);

    if (affectedInstanceCount > 0 && removedAssetIds.length > 0) {
      this.assets.releaseAssets(removedAssetIds.flatMap((assetId) => Array.from({ length: affectedInstanceCount }, () => assetId)));
    }

    this.editorDraft.id = nextPreset.id;
    this.selectedPresetId = nextPreset.id;
    this.editorPresetId = nextPreset.id;
    return nextPreset;
  }

  private async handleDeleteAsset(assetId: string): Promise<void> {
    if (!assetId || assetId === this.defaultBackAssetId) {
      return;
    }
    if (isBuiltinAssetId(assetId)) {
      return;
    }

    const changedPresets = this.deck.clearAssetReference(assetId, this.defaultBackAssetId);
    for (const preset of changedPresets) {
      await this.storage.savePreset(preset);
    }

    if (this.editorDraft.backAssetId === assetId) {
      this.editorDraft.backAssetId = this.defaultBackAssetId;
    }
    this.editorDraft.assignments = Object.fromEntries(
      Object.entries(this.editorDraft.assignments).map(([templateCardId, assignedAssetId]) => [templateCardId, assignedAssetId === assetId ? null : assignedAssetId]),
    );
    this.editorDraft.extraCards = this.editorDraft.extraCards.map((card) =>
      card.frontAssetId === assetId
        ? {
            ...card,
            frontAssetId: null,
          }
        : card,
    );

    this.assets.forgetAsset(assetId);
    await this.storage.deleteAsset(assetId);
    this.assetsLibrary = await this.storage.getAssets();
    this.editor.setStatus(t('msg.deletedAsset'));
    this.render();
    this.refreshEditorUi();
  }

  private async handleCreateFolder(): Promise<void> {
    const name = this.editor.getFolderName();
    if (!name) {
      return;
    }
    const folder: AssetFolder = {
      id: createId('folder'),
      name,
      orderIndex: this.folders.length,
    };
    await this.storage.saveFolder(folder);
    this.folders = await this.storage.getFolders();
    this.selectedFolderId = folder.id;
    this.render();
    this.refreshEditorUi();
  }

  private async handleExportDeck(presetId: string | null): Promise<void> {
    if (!presetId) {
      return;
    }
    const preset = this.deck.getPreset(presetId);
    if (!preset) {
      return;
    }
    const assetIds = this.collectPresetAssetIds(preset);
    const packAssets = await this.collectPackAssets(assetIds);
    const folderIds = new Set(
      packAssets
        .map((entry) => entry.asset.folderId)
        .filter((folderId): folderId is string => typeof folderId === 'string' && folderId.length > 0),
    );
    const folders = this.folders.filter((folder) => folderIds.has(folder.id));
    const exportedAt = Date.now();
    const manifest = {
      kind: 'tarotpack' as const,
      version: 2 as const,
      exportedAt,
      folders,
      assets: packAssets.map<TarotPackAssetEntry>(({ asset, path }) => ({
        asset: { ...asset },
        path,
      })),
      preset: {
        ...preset,
        assignments: { ...preset.assignments },
        extraCards: preset.extraCards.map((card) => ({ ...card })),
      },
    };
    const archive = await createTarotPackBlob({
      manifest,
      assets: packAssets,
    });
    if (archive.size === 0) {
      throw new Error('Generated empty tarotpack blob');
    }
    const filename = createTarotPackFilename(preset.name);
    await this.updateExportDownload(filename, archive, packAssets.length);
    this.editor.setStatus(t('msg.exportedDeck', { name: preset.name }));
  }

  private async handleImportDeck(): Promise<void> {
    const files = Array.from(this.editor.deckImportInput.files ?? []);
    this.editor.deckImportInput.value = '';
    if (files.length === 0) {
      return;
    }

    const importedPresets: DeckPreset[] = [];
    for (const file of files) {
      const parsed = await parseTarotPackFile(file);
      if (!parsed) {
        continue;
      }
      const imported = await this.importPresetBundle([parsed.manifest.preset], parsed.manifest.folders ?? [], parsed.assets);
      importedPresets.push(...imported);
    }

    const preset = importedPresets[importedPresets.length - 1];
    if (!preset) {
      this.editor.setStatus(t('msg.invalidImportFile'));
      return;
    }
    this.selectedPresetId = preset.id;
    this.loadEditorPreset(preset.id);
    this.editor.closeImportModal();
    this.editor.setStatus(
      importedPresets.length === 1 ? t('msg.importedDeck', { name: preset.name }) : t('msg.importedDecks', { count: importedPresets.length }),
    );
  }

  private async handleCopyExportText(): Promise<void> {
    const value = this.editor.exportTextArea.value;
    if (!value) {
      this.editor.setStatus(t('msg.noPackText'));
      return;
    }
    this.editor.exportTextArea.focus();
    this.editor.exportTextArea.select();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        this.editor.setStatus(t('msg.copiedPackText'));
        return;
      }
    } catch {
      // Fall through to execCommand fallback.
    }

    try {
      const copied = document.execCommand('copy');
      if (copied) {
        this.editor.setStatus(t('msg.copiedPackText'));
        return;
      }
    } catch {
      // Fall through to manual selection status.
    }
    this.editor.setStatus(t('msg.copyPackTextFailed'));
  }

  private async handleImportPackText(): Promise<void> {
    const value = this.editor.getImportText();
    if (!value) {
      return;
    }
    const parsed = await parseTarotPackDataUrl(value);
    if (!parsed) {
      this.editor.setStatus(t('msg.invalidPackText'));
      return;
    }
    const imported = await this.importPresetBundle([parsed.manifest.preset], parsed.manifest.folders ?? [], parsed.assets);
    const preset = imported[imported.length - 1];
    if (!preset) {
      this.editor.setStatus(t('msg.invalidPackText'));
      return;
    }
    this.selectedPresetId = preset.id;
    this.loadEditorPreset(preset.id);
    this.editor.closeImportModal();
    this.editor.setStatus(t('msg.importedDeck', { name: preset.name }));
  }

  private async syncEditorOverlay(): Promise<void> {
    this.editor.applyTranslations();
    this.editor.syncPresetOptions(this.deck.getPresets(), this.editorPresetId ?? this.selectedPresetId);
    this.editor.syncFolders(this.folders, this.selectedFolderId);
    if (!this.editor.isOpen()) {
      return;
    }
    this.editor.syncDraftTextInputs(this.editorDraft.name);

    const cards = this.getEditorPreviewCards();
    const urls = new Map<string, string | null>();
    const aspectRatios = new Map<string, number>();
    await Promise.all(
      cards.map(async (card) => {
        const preview = await this.previews.getPreviewData(card.frontAssetId);
        urls.set(card.id, preview?.url ?? null);
        aspectRatios.set(card.id, preview?.aspectRatio ?? CARD_WIDTH / CARD_HEIGHT);
      }),
    );
    const assetPreviewUrls = new Map<string, string | null>();
    await Promise.all(
      this.assetsLibrary
        .filter((asset) => asset.kind === 'front')
        .map(async (asset) => {
          const preview = await this.previews.getPreviewData(asset.id);
          assetPreviewUrls.set(asset.id, preview?.url ?? null);
        }),
    );

    this.editor.syncPreviewList(
      cards,
      urls,
      aspectRatios,
      (id) => {
        this.editorSelectedCardId = id;
        const selectedCard = cards.find((card) => card.id === id);
        const selectedUrl = urls.get(id) ?? null;
        const selectedAspectRatio = aspectRatios.get(id) ?? null;
        const assignedAssetLabel =
          selectedCard && selectedCard.kind === 'custom'
            ? this.assetsLibrary.find((asset) => asset.id === this.editorDraft.extraCards.find((card) => card.id === selectedCard.id)?.frontAssetId)?.label ?? null
            : selectedCard
              ? this.assetsLibrary.find((asset) => asset.id === this.editorDraft.assignments[selectedCard.id])?.label ?? null
              : null;
        const backAssetLabel = this.assetsLibrary.find((asset) => asset.id === this.editorDraft.backAssetId)?.label ?? null;
        this.editor.syncDetail(selectedCard ?? null, selectedUrl, selectedAspectRatio, assignedAssetLabel, backAssetLabel);
        this.editor.openLightbox(urls.get(id) ?? null, selectedCard?.title ?? '', aspectRatios.get(id) ?? null);
      },
    );

    const selected = cards.find((card) => card.id === this.editorSelectedCardId) ?? null;
    const selectedUrl = selected ? urls.get(selected.id) ?? null : null;
    const selectedAspectRatio = selected ? aspectRatios.get(selected.id) ?? null : null;
    const assignedAssetLabel =
      selected && selected.kind === 'custom'
        ? this.assetsLibrary.find((asset) => asset.id === this.editorDraft.extraCards.find((card) => card.id === selected.id)?.frontAssetId)?.label ?? null
        : selected
          ? this.assetsLibrary.find((asset) => asset.id === this.editorDraft.assignments[selected.id])?.label ?? null
          : null;
    const backAssetLabel = this.assetsLibrary.find((asset) => asset.id === this.editorDraft.backAssetId)?.label ?? null;
    this.editor.setCurrentBackLabel(backAssetLabel);
    this.editor.syncDetail(selected, selectedUrl, selectedAspectRatio, assignedAssetLabel, backAssetLabel);
    this.editor.syncLightboxAssets(
      this.assetsLibrary,
      this.selectedFolderId,
      assetPreviewUrls,
      (assetId) => {
        void this.assignSelectedEditorAsset(assetId);
      },
      (assetId) => {
        void this.handleDeleteAsset(assetId);
      },
      (assetId) => !isBuiltinAssetId(assetId),
    );
    this.editor.syncAssetListWithDelete(
      this.assetsLibrary,
      this.selectedFolderId,
      assetPreviewUrls,
      (assetId) => {
        void this.assignSelectedEditorAsset(assetId);
      },
      (assetId) => {
        void this.handleDeleteAsset(assetId);
      },
      (assetId) => !isBuiltinAssetId(assetId),
    );
  }

  private refreshEditorUi(): void {
    void this.syncEditorOverlay();
  }

  private stepEditorPreviewCard(direction: -1 | 1): void {
    const cards = this.getEditorPreviewCards();
    if (cards.length === 0) {
      return;
    }
    const currentIndex = Math.max(
      0,
      cards.findIndex((card) => card.id === this.editorSelectedCardId),
    );
    const nextIndex = (currentIndex + direction + cards.length) % cards.length;
    this.editorSelectedCardId = cards[nextIndex].id;
    void this.syncEditorOverlay().then(() => {
      const selected = this.getEditorPreviewCards().find((card) => card.id === this.editorSelectedCardId);
      if (!selected) {
        return;
      }
      void this.previews.getPreviewData(selected.frontAssetId).then((preview) => {
        this.editor.openLightbox(preview?.url ?? null, selected.title, preview?.aspectRatio ?? CARD_WIDTH / CARD_HEIGHT);
      });
    });
  }

  private getEditorPreviewCards(): PreviewCardItem[] {
    const search = this.editor.getSearchTerm();
    const templateCards = getTemplatesForMode(this.editorMode).map((template) => ({
      id: template.templateCardId,
      kind: 'template' as const,
      title: this.deck.getTemplateName(template.templateCardId),
      subtitle: template.arcana === 'major' ? 'Template' : `${template.suit} ${template.rank}`,
      frontAssetId: this.editorDraft.assignments[template.templateCardId] ?? null,
    }));
    const extraCards = [...this.editorDraft.extraCards]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((card) => ({
        id: card.id,
        kind: 'custom' as const,
        title: card.name || t('ui.unnamedCustomCard'),
        subtitle: 'Custom',
        frontAssetId: card.frontAssetId,
      }));
    return [...templateCards, ...extraCards].filter((card) => {
      if (!search) {
        return true;
      }
      return `${card.title} ${card.subtitle}`.toLowerCase().includes(search);
    });
  }

  private createUniquePresetName(baseName: string): string {
    const existing = new Set(this.deck.getPresets().map((preset) => preset.name));
    if (!existing.has(baseName)) {
      return baseName;
    }
    let suffix = 2;
    while (existing.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  }

  private getRenderedCardSize(card: CardModel) {
    const frontTexture = card.frontAssetId ? this.assets.getTexture(card.frontAssetId) : null;
    const backTexture = card.backAssetId ? this.assets.getTexture(card.backAssetId) : null;
    return getCardDisplaySize(frontTexture, backTexture);
  }

  private async collectPackAssets(assetIds: string[]): Promise<Array<{ asset: AssetRecord; path: string; blob: Blob }>> {
    const assetIdsSet = new Set(assetIds.filter((assetId) => !isBuiltinAssetId(assetId)));
    const assetsById = new Map(this.assetsLibrary.map((asset) => [asset.id, asset] as const));
    const serialized: Array<{ asset: AssetRecord; path: string; blob: Blob }> = [];
    let assetIndex = 0;
    for (const assetId of assetIdsSet) {
      const asset = assetsById.get(assetId);
      if (!asset) {
        continue;
      }
      const blob = await this.storage.getAssetBlob(assetId);
      if (!blob) {
        continue;
      }
      serialized.push({
        asset: { ...asset },
        path: createTarotPackAssetPath(asset, assetIndex),
        blob,
      });
      assetIndex += 1;
    }
    return serialized;
  }

  private async updateExportDownload(filename: string, blob: Blob, assetCount: number): Promise<void> {
    const packDataUrl = await blobToDataUrl(blob);
    this.exportDownloadUrl = packDataUrl;
    this.editor.setExportDownload(filename, this.exportDownloadUrl, `${this.formatFileSize(blob.size)} | ${assetCount} assets`);
    this.editor.setExportText(createTarotPackShareText(filename, packDataUrl));
  }

  private formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  private async importPresetBundle(
    presets: DeckPreset[],
    folders: AssetFolder[],
    assets: Array<{ asset: AssetRecord; blob: Blob }>,
  ): Promise<DeckPreset[]> {
    const folderIdMap = new Map<string, string>([
      [ROOT_FOLDER_ID, ROOT_FOLDER_ID],
      [BUILTIN_WAITE_FOLDER_ID, BUILTIN_WAITE_FOLDER_ID],
    ]);

    for (const folder of folders) {
      if (folder.id === ROOT_FOLDER_ID || folder.id === BUILTIN_WAITE_FOLDER_ID) {
        continue;
      }
      const nextFolderId = createId('folder');
      folderIdMap.set(folder.id, nextFolderId);
      await this.storage.saveFolder({
        ...folder,
        id: nextFolderId,
      });
    }

    const assetsToSave: Array<{ asset: AssetRecord; blob: Blob }> = [];
    const assetIdMap = new Map<string, string>();
    for (const entry of assets) {
      if (isBuiltinAssetId(entry.asset.id)) {
        assetIdMap.set(entry.asset.id, entry.asset.id);
        continue;
      }
      const nextAssetId = createId('asset');
      assetIdMap.set(entry.asset.id, nextAssetId);
      assetsToSave.push({
        asset: {
          ...entry.asset,
          id: nextAssetId,
          folderId: entry.asset.folderId ? folderIdMap.get(entry.asset.folderId) ?? ROOT_FOLDER_ID : ROOT_FOLDER_ID,
        },
        blob: entry.blob,
      });
    }
    if (assetsToSave.length > 0) {
      await this.storage.saveAssets(assetsToSave);
    }

    const importedPresets: DeckPreset[] = [];
    for (const preset of presets) {
      const nextPreset: DeckPreset = {
        ...preset,
        id: createId('preset'),
        name: this.createUniquePresetName(preset.name),
        backAssetId: preset.backAssetId ? assetIdMap.get(preset.backAssetId) ?? preset.backAssetId : null,
        assignments: Object.fromEntries(
          Object.entries(preset.assignments).map(([templateCardId, assetId]) => [templateCardId, assetId ? assetIdMap.get(assetId) ?? assetId : null]),
        ),
        extraCards: preset.extraCards.map((card) => ({
          ...card,
          frontAssetId: card.frontAssetId ? assetIdMap.get(card.frontAssetId) ?? card.frontAssetId : null,
        })),
        updatedAt: Date.now(),
      };
      await this.storage.savePreset(nextPreset);
      this.deck.upsertPreset(nextPreset);
      importedPresets.push(nextPreset);
    }

    this.assetsLibrary = await this.storage.getAssets();
    this.folders = await this.storage.getFolders();
    this.render();
    this.refreshEditorUi();
    return importedPresets;
  }
}
