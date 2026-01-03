<script>
  import { i18n } from '../../utils/i18n.js';

  let { currentPage, totalPages, startIndex, endIndex, totalItems, onPrev, onNext, onLast } =
    $props();
</script>

<div class="pagination-controls">
  <button class="btn btn-sm" onclick={onPrev} disabled={currentPage === 0}>
    {i18n.previous}
  </button>
  <span class="page-info">
    {i18n.pageOf(currentPage + 1, totalPages)}
    {i18n.showing(startIndex + 1, endIndex, totalItems)}
  </span>
  <button class="btn btn-sm" onclick={onNext} disabled={currentPage === totalPages - 1}>
    {i18n.next}
  </button>
  <button class="btn btn-sm" onclick={onLast}>
    {i18n.last}
  </button>
</div>

<style>
  .pagination-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin-bottom: 15px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .page-info {
    font-size: 14px;
    color: #666;
    font-weight: 500;
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

  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }
</style>
