(function updateSettingsDialog(newValues) {
  // Find the dialog container.
  const dialog = document.querySelector('[data-name="indicator-properties-dialog"]');
  if (!dialog) {
    console.error('Settings dialog not found.');
    return;
  }
  const content = dialog.querySelector('.content-tBgV1m0B');
  if (!content) {
    console.error('Content container not found.');
    return;
  }

  // Gather all cells in the dialog.
  const cells = Array.from(content.querySelectorAll('.cell-tBgV1m0B'));

  // Loop through the cells.
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const cellText = cell.textContent ? cell.textContent.trim() : '';

    // CASE 1: Check if the cell contains a checkbox (label and checkbox in the same cell)
    const checkboxEl = cell.querySelector('input[type="checkbox"]');
    if (checkboxEl) {
      const labelEl = cell.querySelector('.label-ZOx_CVY3');
      const label = labelEl ? labelEl.textContent.trim() : cellText;
      if (newValues.hasOwnProperty(label)) {
        const desired = Boolean(newValues[label]);
        if (checkboxEl.checked !== desired) {
          // Instead of directly setting .checked, simulate a click.
          checkboxEl.click();
          // Dispatch a change event as well, if necessary.
          checkboxEl.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`Clicked checkbox "${label}" to change to ${checkboxEl.checked}`);
        } else {
          console.log(`Checkbox "${label}" already in desired state: ${checkboxEl.checked}`);
        }
      }
      continue; // Move to next cell.
    }

    // CASE 2: Assume the current cell is a label cell and the next cell contains the input element.
    const nextCell = cells[i + 1];
    if (nextCell) {
      const inputEl = nextCell.querySelector('input, select, textarea, [role="button"]');
      if (inputEl) {
        const label = cellText || 'Unnamed Setting';
        if (newValues.hasOwnProperty(label)) {
          // For input elements.
          if (inputEl.tagName.toLowerCase() === 'input') {
            const type = inputEl.getAttribute('type');
            if (type === 'number') {
              inputEl.value = newValues[label];
              inputEl.dispatchEvent(new Event('change', { bubbles: true }));
              console.log(`Updated number input "${label}" to ${inputEl.value}`);
            } else {
              inputEl.value = newValues[label];
              inputEl.dispatchEvent(new Event('change', { bubbles: true }));
              console.log(`Updated text input "${label}" to ${inputEl.value}`);
            }
          } else if (inputEl.tagName.toLowerCase() === 'select' || inputEl.getAttribute('role') === 'button') {
            inputEl.textContent = newValues[label];
            console.log(`Updated dropdown "${label}" to ${inputEl.textContent}`);
          }
        }
        i++; // Skip the next cell since we've processed it.
      }
    }
  }
})({
  // Sample new settings values. Adjust these keys to match exactly the labels in your dialog:
  'Length for Main Stochastic': 20,
  'SmoothK for Main Stochastic': 4,
  'SmoothD for Main Stochastic': 4,
  'Upper Line Value?': 90,
  'Lower Line Value?': 30,
  'Use Current Chart Resolution?': false,
  'Show Mid Line?': false,
  'Use Different Timeframe? Uncheck Box Above': '5 min',
});
