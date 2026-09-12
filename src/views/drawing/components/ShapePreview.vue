<template>
  <span class="shape-preview" :class="[`is-${preview}`, { 'is-compact': compact }]" aria-hidden="true">
    <svg v-if="path" class="shape-svg" viewBox="0 0 32 24">
      <path :d="path" />
    </svg>
    <i v-else></i>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  preview: { type: String, default: 'rect' },
  compact: { type: Boolean, default: false }
})

const SVG_PATHS = {
  star: 'M16 3 L18.12 9.09 L24.56 9.22 L19.42 13.11 L21.29 19.28 L16 15.6 L10.71 19.28 L12.58 13.11 L7.44 9.22 L13.88 9.09 Z',
  hexagon: 'M10.5 5 H21.5 L27 12 L21.5 19 H10.5 L5 12 Z',
  diamond: 'M16 4.5 L25.5 12 L16 19.5 L6.5 12 Z',
  triangle: 'M16 5 L26.5 19.5 H5.5 Z',
  parallelogram: 'M10 6 H26 L22 18 H6 Z',
  display: 'M8 6 H26 V18 H8 L4 12 Z',
  note: 'M8 4 H20 L24 8 V20 H8 Z',
  'er-ident': 'M16 4.5 L25.5 12 L16 19.5 L6.5 12 Z'
}

const path = computed(() => SVG_PATHS[props.preview] || '')
</script>

<style scoped>
.shape-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 32px;
  overflow: visible;
  color: inherit;
}
.shape-preview.is-compact {
  width: 32px;
  height: 24px;
}
.shape-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.shape-preview i {
  display: block;
  box-sizing: border-box;
  border: 1.5px solid currentColor;
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
}
.is-rect i,
.is-process i { width: 30px; height: 16px; border-radius: 3px; }
.is-rounded i { width: 30px; height: 16px; border-radius: 8px; }
.is-circle i { width: 18px; height: 18px; border-radius: 50%; }
.is-ellipse i,
.is-terminator i { width: 28px; height: 16px; border-radius: 10px; }
.is-cloud i { width: 28px; height: 16px; border-radius: 12px; }
.is-cylinder i { width: 18px; height: 22px; border-radius: 10px / 5px; }
.is-document i { width: 20px; height: 22px; border-radius: 2px 2px 8px 8px; }
.is-sticky i { width: 18px; height: 18px; border-radius: 2px; background: #fef3c7; border-color: #f59e0b; }
.is-text i { width: 26px; height: 2px; border: 0; background: currentColor; box-shadow: 0 6px 0 currentColor, 0 12px 0 currentColor; }
.is-image i { width: 24px; height: 18px; border-style: dashed; border-radius: 3px; }
.is-container i { width: 30px; height: 20px; border-style: dashed; border-radius: 4px; }
.is-delay i { width: 24px; height: 16px; border-radius: 0 10px 10px 0; }
.is-manual i { width: 26px; height: 16px; transform: skewY(-8deg); }
.is-mind-root i { width: 28px; height: 14px; border-radius: 10px; background: color-mix(in srgb, var(--accent-color) 18%, transparent); border-color: var(--accent-color); }
.is-mind-topic i { width: 26px; height: 12px; border-radius: 6px; }
.is-mind-sub i { width: 22px; height: 10px; border-radius: 4px; }
.is-mind-callout i { width: 24px; height: 14px; border-radius: 10px; background: #fef3c7; border-color: #f59e0b; }
.is-er-entity i,
.is-er-weak i { width: 28px; height: 16px; border-radius: 3px; }
.is-er-weak i { outline: 1px solid currentColor; outline-offset: 2px; }
.is-er-key i { width: 26px; height: 14px; border-radius: 10px; }
.is-uml-class i { width: 24px; height: 22px; border-radius: 2px; background: linear-gradient(#c4b5fd 0 7px, transparent 7px) padding-box; }
.is-actor i { width: 12px; height: 20px; border-radius: 8px 8px 2px 2px; }
.is-package i { width: 26px; height: 18px; border-radius: 2px; }
.is-component i { width: 26px; height: 16px; border-radius: 3px; }
.is-tl-axis i { width: 32px; height: 3px; border: 0; background: currentColor; border-radius: 2px; }
.is-seq-actor i { width: 16px; height: 22px; border-radius: 3px 3px 0 0; box-shadow: inset 0 -12px 0 -10px currentColor; }
.is-seq-act i { width: 6px; height: 20px; border-radius: 1px; }
.is-arch-client i,
.is-arch-server i,
.is-arch-queue i,
.is-arch-cache i { width: 28px; height: 14px; border-radius: 6px; }
.is-dfd-ext i { width: 26px; height: 16px; border-width: 2px; }
.is-dfd-store i { width: 28px; height: 12px; border-left-width: 3px; border-right-width: 3px; }
.is-line-straight i,
.is-line-arrow i,
.is-line-double i,
.is-line-dashed i,
.is-line-orth i,
.is-line-manhattan i,
.is-line-curve i,
.is-line-assoc i { width: 30px; height: 0; border-top-width: 1.6px; border-radius: 0; background: none; }
.is-line-dashed i { border-top-style: dashed; }
.is-line-arrow i { clip-path: polygon(0 0, 100% 0, 100% 100%); }
.is-anim-pulse i,
.is-anim-breathe i,
.is-anim-bounce i { width: 16px; height: 16px; border-radius: 50%; }
.is-anim-flow i { width: 28px; height: 0; border-top: 1.6px dashed currentColor; }
.is-anim-stop i { width: 12px; height: 12px; border-radius: 2px; }
.is-tpl-mind i,
.is-tpl-flow i,
.is-tpl-er i,
.is-tpl-timeline i,
.is-tpl-seq i,
.is-tpl-arch i,
.is-tpl-dfd i { width: 28px; height: 18px; border-style: dashed; border-radius: 4px; }
</style>
