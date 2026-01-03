<script>
  import { i18n } from '../../utils/i18n.js';

  let { messages = [], onExport, onImport, onClear } = $props();
</script>

<div class="actions-panel">
  <button class="btn btn-success" onclick={onExport} disabled={messages.length === 0}>
    {i18n.exportMessages(messages.length)}
  </button>

  <label class="btn btn-info file-label">
    {i18n.importMessages}
    <input type="file" accept=".json" onchange={onImport} style="display: none;" />
  </label>

  <button class="btn btn-warning" onclick={onClear} disabled={messages.length === 0}>
    {i18n.clearMessages}
  </button>
</div>

<style>
  .actions-panel {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-success {
    background: #28a745;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background: #218838;
  }

  .btn-info {
    background: #17a2b8;
    color: white;
  }

  .btn-info:hover:not(:disabled) {
    background: #138496;
  }

  .btn-warning {
    background: #ffc107;
    color: #333;
  }

  .btn-warning:hover:not(:disabled) {
    background: #e0a800;
  }

  .file-label {
    display: inline-block;
  }
</style>
