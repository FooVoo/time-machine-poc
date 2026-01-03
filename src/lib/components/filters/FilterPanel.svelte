<script>
  import { i18n } from '../../utils/i18n.js';

  let {
    filterRequestId = $bindable(''),
    customFilterField = $bindable(''),
    customFilterValue = $bindable(''),
    groupByRequestId = $bindable(false),
    availableFields = [],
    fieldIsFilterable = false,
    availableValues = [],
  } = $props();
</script>

<div class="filter-panel">
  <div class="filter-section">
    <h3>{i18n.filterByRequestId}</h3>
    <div class="input-group">
      <label for="filter">{i18n.requestIdLabel}</label>
      <input
        id="filter"
        type="text"
        bind:value={filterRequestId}
        placeholder={i18n.requestIdPlaceholder}
      />
    </div>
  </div>

  <div class="filter-section">
    <h3>{i18n.filterByCustomField}</h3>
    <div class="custom-filter-group">
      <div class="input-group">
        <label for="custom-field">{i18n.fieldLabel}</label>
        <input
          id="custom-field"
          type="text"
          bind:value={customFilterField}
          list="field-suggestions"
          placeholder={i18n.fieldPlaceholder}
          autocomplete="off"
        />
        <datalist id="field-suggestions">
          {#each availableFields as field (field)}
            <option value={field}></option>
          {/each}
        </datalist>
      </div>
      <div class="input-group">
        <label for="custom-value">{i18n.valueLabel}</label>
        <input
          id="custom-value"
          type="text"
          bind:value={customFilterValue}
          list={fieldIsFilterable ? 'value-suggestions' : null}
          placeholder={i18n.valuePlaceholder}
          disabled={!fieldIsFilterable}
          title={fieldIsFilterable ? i18n.selectValueFromList : i18n.selectPrimitiveField}
        />
        {#if fieldIsFilterable}
          <datalist id="value-suggestions">
            {#each availableValues as value (value)}
              <option value={value}></option>
            {/each}
          </datalist>
        {/if}
      </div>
    </div>
  </div>

  <label class="checkbox-label">
    <input type="checkbox" bind:checked={groupByRequestId} />
    {i18n.groupByRequestId}
  </label>
</div>

<style>
  .filter-panel {
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .filter-section {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 15px;
  }

  .filter-section:last-of-type {
    border-bottom: none;
  }

  .filter-section h3 {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  .custom-filter-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .input-group {
    margin-bottom: 15px;
  }

  .input-group label {
    display: block;
    margin-bottom: 5px;
    color: #555;
    font-weight: 500;
  }

  .input-group input[type='text'] {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  }

  .input-group input[type='text']:disabled {
    background: #f0f0f0;
    cursor: not-allowed;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    color: #555;
    font-weight: 500;
  }

  .checkbox-label input[type='checkbox'] {
    cursor: pointer;
  }
</style>
