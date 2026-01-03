<script>
  import NestedDataViewer from './NestedDataViewer.svelte';

  let { data, messageIndex, expandedPaths, onTogglePath } = $props();
</script>

<div class="json-viewer">
  <NestedDataViewer {data} {messageIndex} {expandedPaths} {onTogglePath} path="" />
</div>

<style>
  .json-viewer {
    margin-top: 10px;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 10px;
    overflow: auto;
    max-height: 400px;
  }
</style>
