import Dragger from "../utils/dragger.js";

type FromPos = {
  fromX: number;
  fromY: number;
};
type ToPos = {
  toX: number;
  toY: number;
};

/**
 * 这不是一个工具类，而是一段公共逻辑代码块
 * 分类题公共拖拽控制部分
 * 依赖于category-index/index.tsx 中的dom结构
 */
export function beginDrag($section, event, getCorrectOpt): void {
  _ensureIgnoreMouse(event);
  if (_ignoreNextMouse(event)) {
    return;
  }
  // 找到页面边界.base-layout
  const $baseLayout = $section.current.closest(".base-layout");
  // if (!$baseLayout) {
  //   return ;
  // }
  const dragger = new Dragger("category-template-ctn");
  // 是手动点的，不是收到信令触发的
  const moveScale = 1.15;
  const dropScale = 0.45;
  dragger.beginDrag({
    event: event,
    $pageContainer: $section.current.parentNode, // 模板容器，页面dom
    $movingBoundary: $baseLayout, // 移动边界
    dragWrapClass: "category-option-wrapper", // 标记被拖拽部分的class
    domIndex: "data-index", // 标记dom索引的attribute
    pageScale: 1, // 页面 scale 缩放后需要使用 pageScale 换算移动距离
    moveScale,
    dropScale,
    transition: false,
    // 是否允许落下判断，返回true or false
    allowDrop: ($draggle: HTMLElement, $dropzone: HTMLElement): boolean => {
      if (
        $draggle.getAttribute("data-type") ===
        $dropzone.getAttribute("data-type")
      ) {
        getCorrectOpt(true, $draggle.getAttribute("data-index"));
        return true;
      } else {
        getCorrectOpt(false, $draggle.getAttribute("data-index"));
        return false;
      }
    },
    setDropingStyle: (
      $draggle: HTMLElement,
      $placeholder: HTMLElement,
      translatePos: { translateX: number; translateY: number }
    ) => {
      $draggle.style.transition = "all 0.434s cubic-bezier(.22,.94,0,1)";
      return false;
    },
    // 开始拖动回调
    onDraggleStart: (
      $draggle: HTMLElement,
      startPos: { clientX: number; clientY: number },
      translate: { translateX: number; translateY: number }
    ): void => {
      $section.current
        .querySelectorAll(".category-question-dropzone .category-border")
        .forEach((el) => {
          (el as HTMLElement).style.opacity = "1";
        });
    },
    // 拖动结束回调
    onDraggleEnd: (
      $draggle: any,
      startPos: { clientX: number; clientY: number },
      currentPos: { clientX: number; clientY: number },
      $dropzone: HTMLElement
    ): void => {
      $draggle.parentNode.style.zIndex = 1;
      $section.current
        .querySelectorAll(".category-question-dropzone .category-border")
        .forEach((el) => {
          (el as HTMLElement).style.opacity = "0";
          (el as HTMLElement).style.borderColor = "#fff";
        });
    },
    // 进入感应区后，当前边框变#FFE663，其他边框恢复白色
    onEnterDropzone: ($dropzone) => {
      $section.current
        .querySelectorAll(".category-question-wrapper.dropzone ")
        .forEach((item) => {
          if (item.classList.contains("active")) {
            (item.previousElementSibling as HTMLElement).style.borderColor =
              "#FFE663";
          } else {
            (item.previousElementSibling as HTMLElement).style.borderColor =
              "#fff";
          }
        });
    },
    // 退出感应区后，边框恢复白色
    onQuitDropzone: ($dropzone) => {
      $dropzone?.$content.parentElement
        .querySelectorAll(".category-border")
        .forEach((el) => {
          (el as HTMLElement).style.borderColor = "#fff";
        });
    },

    onDropStart: (
      $draggle: HTMLElement,
      $dropzone: HTMLElement,
      from: FromPos,
      to: ToPos
    ) => {},
    onRefuseDropStart: (
      $draggle: HTMLElement,
      $dropzone: HTMLElement,
      from: FromPos,
      to: ToPos
    ) => {
      /**
       * animation（在errorOptionEffect中使用）与tansform（在退回的动画里使用）同时使用，退回动画的transition失效；
       * 将errorOptionEffect用在$draggle的子元素animationWrapper中以解决此问题
       */

      const animationWrapper = $draggle.getElementsByClassName(
        "animation-wrapper"
      )[0] as HTMLElement;
      return new Promise((resolve, reject) => {});
    },
    onDropEnd: (
      $draggle: any,
      $dropzone: HTMLElement,
      from: FromPos,
      to: ToPos
    ) => {
      $draggle && ($draggle.parentNode.style.zIndex = 0);
      // console.log('onDropEnd');
    },
    onRefuseDropEnd: (
      $draggle: HTMLElement,
      $dropzone: HTMLElement,
      from: FromPos,
      to: ToPos
    ) => {
      // console.log('onRefuseDropEnd');
    },
    goBackStart: (
      $draggle: HTMLElement,
      $dropzone: HTMLElement,
      from: FromPos,
      to: ToPos
    ) => {
      // console.log('goBackStart');
    },
    goBackEnd: (
      $draggle: HTMLElement,
      $dropzone: HTMLElement,
      from: FromPos,
      to: ToPos
    ) => {
      // console.log('goBackEnd');
    },
  });
}

//
let ignoreNextMouseEvent = false;
function _ensureIgnoreMouse(event) {
  if (event.type === "touchstart") {
    ignoreNextMouseEvent = true;
    let recoverIgnore = () => {
      // 这里需要延一下，因为touchend可能会比mouseup事件先触发
      setTimeout(() => {
        ignoreNextMouseEvent = false;
        document.removeEventListener("touchend", recoverIgnore);
      }, 200);
    };
    document.addEventListener("touchend", recoverIgnore);
  }
}

function _ignoreNextMouse(event) {
  return ignoreNextMouseEvent && ~["mousedown", "mouseup"].indexOf(event.type);
}
