<template>
  <node-view-wrapper class="code-block-component">
    <div class="code-block-header">
      <select
        v-model="selectedLanguage"
        class="language-select"
        @change="updateLanguage"
      >
        <option value="">auto</option>
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="csharp">C#</option>
        <option value="go">Go</option>
        <option value="rust">Rust</option>
        <option value="php">PHP</option>
        <option value="ruby">Ruby</option>
        <option value="swift">Swift</option>
        <option value="kotlin">Kotlin</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="scss">SCSS</option>
        <option value="sql">SQL</option>
        <option value="json">JSON</option>
        <option value="yaml">YAML</option>
        <option value="markdown">Markdown</option>
        <option value="bash">Bash</option>
        <option value="shell">Shell</option>
        <option value="plaintext">Plain Text</option>
      </select>
    </div>
    <pre><node-view-content as="code" /></pre>
  </node-view-wrapper>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3';

const props = defineProps({
  node: Object,
  updateAttributes: Function
});

const selectedLanguage = ref('');

onMounted(() => {
  const language = props.node.attrs.language || '';
  selectedLanguage.value = language;
});

const updateLanguage = (event) => {
  const target = event.target;
  const language = target.value;
  props.updateAttributes({ language: language || null });
};
</script>

<style scoped>
.code-block-component {
  position: relative;
  margin: 1em 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #282c34;
  border: 1px solid #3e4451;
}

.code-block-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 6px 12px;
  background-color: #21252b;
  border-bottom: 1px solid #3e4451;
}

.language-select {
  background-color: #2c313a;
  color: #abb2bf;
  border: 1px solid #4b5263;
  border-radius: 4px;
  padding: 4px 24px 4px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235c6370' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.language-select:hover {
  border-color: #5c6370;
}

.language-select:focus {
  border-color: #61afef;
}

.language-select option {
  background-color: #21252b;
  color: #abb2bf;
}

pre {
  margin: 0;
  padding: 16px;
  background-color: transparent;
  overflow-x: auto;
}

pre code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #abb2bf;
  tab-size: 2;
}
</style>
