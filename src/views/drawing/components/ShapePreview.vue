<template>
  <span class="shape-preview" :class="[`is-${preview}`, { 'is-compact': compact }]" aria-hidden="true">
    <i></i>
  </span>
</template>

<script setup>
defineProps({
  preview: { type: String, default: 'rect' },
  compact: { type: Boolean, default: false }
})
</script>

<style scoped>
.shape-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 32px;
  color: inherit;
}
.shape-preview.is-compact {
  width: 32px;
  height: 24px;
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
.is-diamond i,
.is-er-ident i { width: 18px; height: 18px; transform: rotate(45deg); border-radius: 1px; }
.is-triangle i {
  width: 0; height: 0; border: 0; background: transparent;
  border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 16px solid currentColor;
}
.is-parallelogram i { width: 28px; height: 14px; transform: skewX(-18deg); }
.is-hexagon i { width: 24px; height: 16px; border-radius: 3px; clip-path: polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%); }
.is-star i { width: 18px; height: 18px; clip-path: polygon(50% 0, 61% 35%, 100% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 0 35%, 39% 35%); }
.is-cloud i { width: 28px; height: 16px; border-radius: 12px; }
.is-cylinder i { width: 18px; height: 22px; border-radius: 10px / 5px; }
.is-document i { width: 20px; height: 22px; border-radius: 2px 2px 8px 8px; }
.is-sticky i { width: 18px; height: 18px; border-radius: 2px; background: #fef3c7; border-color: #f59e0b; }
.is-note i { width: 18px; height: 20px; clip-path: polygon(0 0, 70% 0, 100% 30%, 100% 100%, 0 100%); }
.is-text i { width: 26px; height: 2px; border: 0; background: currentColor; box-shadow: 0 6px 0 currentColor, 0 12px 0 currentColor; }
.is-image i { width: 24px; height: 18px; border-style: dashed; border-radius: 3px; }
.is-container i { width: 30px; height: 20px; border-style: dashed; border-radius: 4px; }
.is-delay i { width: 24px; height: 16px; border-radius: 0 10px 10px 0; }
.is-display i { width: 26px; height: 16px; clip-path: polygon(12% 0, 100% 0, 100% 100%, 12% 100%, 0 50%); }
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
