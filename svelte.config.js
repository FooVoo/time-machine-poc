import { svelte } from '@sveltejs/vite-plugin-svelte';

export default {
  plugins: [
    svelte({
      compilerOptions: {
        customElement: true
      }
    })
  ]
};
