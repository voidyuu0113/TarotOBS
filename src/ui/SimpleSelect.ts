export interface SimpleSelectOption {
  value: string;
  label: string;
}

export class SimpleSelect extends EventTarget {
  readonly element = document.createElement('div');
  private readonly trigger = document.createElement('button');
  private readonly menu = document.createElement('div');
  private options: SimpleSelectOption[] = [];
  private selectedValue = '';
  private placeholder = '';
  private open = false;

  constructor(placeholder = '') {
    super();
    this.placeholder = placeholder;
    this.element.className = 'simple-select';
    this.trigger.type = 'button';
    this.trigger.className = 'simple-select-trigger';
    this.menu.className = 'simple-select-menu hidden';
    this.element.append(this.trigger, this.menu);

    this.trigger.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.setOpen(!this.open);
    });

    document.addEventListener('pointerdown', (event) => {
      const target = event.target;
      if (!(target instanceof Node) || this.element.contains(target)) {
        return;
      }
      this.setOpen(false);
    });

    this.render();
  }

  setPlaceholder(placeholder: string): void {
    this.placeholder = placeholder;
    this.render();
  }

  setOptions(options: SimpleSelectOption[]): void {
    this.options = options;
    if (!this.options.some((option) => option.value === this.selectedValue)) {
      this.selectedValue = this.options[0]?.value ?? '';
    }
    this.render();
  }

  setValue(value: string): void {
    this.selectedValue = this.options.some((option) => option.value === value) ? value : '';
    this.render();
  }

  get value(): string {
    return this.selectedValue;
  }

  private selectValue(value: string): void {
    if (value === this.selectedValue) {
      this.setOpen(false);
      return;
    }
    this.selectedValue = value;
    this.render();
    this.setOpen(false);
    this.dispatchEvent(new Event('change'));
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.menu.classList.toggle('hidden', !open);
    this.menu.classList.toggle('visible', open);
    this.trigger.classList.toggle('open', open);
  }

  private render(): void {
    const selected = this.options.find((option) => option.value === this.selectedValue) ?? null;
    this.trigger.textContent = selected?.label ?? this.placeholder;
    this.menu.replaceChildren();
    this.options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'simple-select-option';
      button.textContent = option.label;
      button.classList.toggle('selected', option.value === this.selectedValue);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.selectValue(option.value);
      });
      this.menu.appendChild(button);
    });
  }
}
