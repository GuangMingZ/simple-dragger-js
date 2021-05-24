import commonUtil from "../utils/dragger-caculate-util";

interface DragAttributes {
  // 实例属性
  $draggle: HTMLElement | EventTarget;
  pageClass: string; // 模板容器class名称，string类型
  event: TouchEvent;
  $pageContainer: HTMLElement; // 模板容器，页面dom
  $movingBoundary: HTMLElement; // 可移动的边界，dom对象
  dragWrapClass: string; // 标记可拖拽卡片的class, string变量
  domIndex?: string; // 标记同类型dom的dom attribute name，默认为data-index,例如<div data-index='0'></div>
  pageScale?: number; // 页面 scale 缩放后需要使用 pageScale 换算移动距离
  moveScale?: number; // 移动时元素的 scale 缩放大小
  dropScale?: number; // 放置时元素的 scale 缩放大小
  transition?: boolean; // 感觉没什么用
  onDraggleStart?: (
    $draggle: HTMLElement,
    startPos: { clientX: number; clientY: number },
    translate: { translateX: number; translateY: number }
  ) => void; // 拖拽开始
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface DropZone {
  dropRect: Rect;
  dropSensorRect: Rect;
  dropCenterPos: {
    x: number;
    y: number;
  };
  $content: Node;
}

interface PlaceHolder extends DropZone {
  placeholder: any;
}

interface FromPos {
  fromX: number;
  fromY: number;
}

interface ToPos {
  toX: number;
  toY: number;
}

/**
 * 拖拽功能类
 */
class Dragger {
  // 实例属性
  $draggle: HTMLElement | EventTarget;
  pageClass: string; // 模板容器class名称，string类型
  event: TouchEvent;
  $pageContainer: HTMLElement; // 模板容器，页面dom
  $movingBoundary: HTMLElement; // 可移动的边界，dom对象
  dragWrapClass: string; // 标记可拖拽卡片的class, string变量
  domIndex?: string; // 标记同类型dom的dom attribute name，默认为data-index,例如<div data-index='0'></div>
  pageScale?: number; // 页面 scale 缩放后需要使用 pageScale 换算移动距离
  moveScale?: number; // 移动时元素的 scale 缩放大小
  dropScale?: number; // 放置时元素的 scale 缩放大小
  transition?: boolean = false; // 感觉没什么用
  // 事件回调
  allowDrop?: ($draggle: HTMLElement, dropzoneElement: HTMLElement) => boolean; // 何时允许放置

  setDropingStyle?: (
    $draggle: HTMLElement,
    $placeholder: PlaceHolder,
    translatePos: { translateX: number; translateY: number }
  ) => boolean; // 设置放置样式

  onDraggleStart?: (
    $draggle: HTMLElement,
    startPos: { clientX: number; clientY: number },
    translate: { translateX: number; translateY: number }
  ) => void; // 拖拽开始

  onDraggleEnd?: (
    $draggle: HTMLElement,
    startPos: { clientX: number; clientY: number },
    currentPos: { clientX: number; clientY: number },
    dropzoneElement: HTMLElement
  ) => void; // drag结束事件回调

  onEnterDropzone?: ($dropzone: DropZone) => void; // 进入感应区

  onQuitDropzone?: ($dropzone: DropZone) => void; // 当离开上一个dropzone时触发 onQuitDropzone 钩子

  onDropStart?: (
    $draggle: HTMLElement,
    dropzoneElement: HTMLElement,
    fromPos: FromPos,
    toPos: ToPos
  ) => void; // 放置开始回调

  onRefuseDropStart?: (
    $draggle: HTMLElement,
    dropzoneElement: HTMLElement,
    fromPos: FromPos,
    toPos: ToPos
  ) => void; // 拒绝放置开始回调

  onDropEnd?: (
    $draggle: HTMLElement,
    dropzoneElement: HTMLElement,
    fromPos: FromPos,
    toPos: ToPos
  ) => void; // 正确且动效结束callback

  onRefuseDropEnd?: (
    $draggle: HTMLElement,
    dropzoneElement: HTMLElement,
    fromPos: FromPos,
    toPos: ToPos
  ) => void; // 答案错误时的callback

  onGoBackStart?: (
    $draggle: HTMLElement,
    dropzoneElement: HTMLElement,
    fromPos: FromPos,
    toPos: ToPos
  ) => void; // 答案错误回到原有位置这一行为开始的事件回调 和上面有一定重叠

  onGoBackEnd?: (
    $draggle: HTMLElement,
    dropzoneElement: HTMLElement,
    fromPos: FromPos,
    toPos: ToPos
  ) => void; // 回到原有位置后的事件回调

  constructor({
    $draggle,
    pageClass,
    event,
    $pageContainer,
    $movingBoundary,
    dragWrapClass,
    domIndex = "data-index",
    pageScale = 1,
    moveScale = 1.15,
    dropScale = 0.45,
    transition = false,
    onDraggleStart,
  }: DragAttributes) {
    this.$draggle = $draggle;
    this.pageClass = pageClass;
    this.event = event;
    this.$pageContainer = $pageContainer;
    this.$movingBoundary = $movingBoundary;
    this.dragWrapClass = dragWrapClass;
    this.domIndex = domIndex;
    this.pageScale = pageScale;
    this.moveScale = moveScale;
    this.dropScale = dropScale;
    this.transition = transition;
    this.onDraggleStart = onDraggleStart;

    this.initDragHandler();
  }

  // 初始化 绑定全局鼠标事件
  initDragHandler() {
    // let $draggle = this._getDragCardOpt(this.event.target);
    const $draggle = this.$draggle as any;
    if (!$draggle || $draggle.disabled || $draggle.isDragging) {
      return;
    }
    $draggle.isDragging = true;
    // $draggle.style.zIndex = 9999;
    const touch = this.event.type === "touchstart";

    if (touch === null || touch === undefined) {
      throw new Error("touch is must be avaliable!");
    }

    // 缓存 startPos 以修复 ios9 的 startPos 内部值会不停改变的问题
    let startPos = this.event.touches
      ? this.event.touches[0]
      : (this.event as any);
    startPos = {
      clientX: startPos.clientX,
      clientY: startPos.clientY,
    };
    this.domIndex = this.domIndex ? this.domIndex : "data-index";
    this.pageScale =
      this.pageScale || this.pageScale === 0 ? this.pageScale : 1.0;
    this.moveScale =
      this.moveScale || this.moveScale === 0 ? this.moveScale : 1.15;
    this.dropScale =
      this.dropScale || this.dropScale === 0 ? this.dropScale : 0.45;
    this.transition =
      this.transition === null || this.transition === undefined
        ? true
        : this.transition;

    this.onQuitDropzone =
      typeof this.onQuitDropzone === "function"
        ? this.onQuitDropzone
        : () => {};

    const MOUSE_UP = touch ? "touchend" : "mouseup";
    const MOUSE_MOVE = touch ? "touchmove" : "mousemove";

    // 缓存原来的 style，方便回到原处
    const original_style = $draggle.getAttribute("style");
    const disappearEffect = false;
    // 找出所有的放置区，包括选项的以及题干包含的
    const $contents: Node[] = Array.prototype.slice.call(
      this.$pageContainer.querySelectorAll(".dropzone")
    );
    if (!$contents.length) {
      throw new Error("没有设置放置区");
    }
    // 计算出所有放置区的位置及其感应区域
    const dropList = [];
    $contents.forEach(($content) => {
      dropList.push(this._getDropZoneRect($content, disappearEffect));
    });

    let old_delta_left = 0;
    let old_delta_top = 0;
    // 当前拖拽节点的相关属性
    const { top, left } = commonUtil.getOffsetUntil($draggle, this.pageClass);
    const dragRect = {
      left,
      top,
      width: $draggle.clientWidth,
      height: $draggle.clientHeight,
    };

    // 由于被点击时可能已经有 translate 了，需要加上 translate 内的 x y
    if ($draggle.style && $draggle.style.transform) {
      const reg = $draggle.style.transform.match(/translate\((.*?)\)/);
      const res = reg && reg[1].split(" ");
      if (res) {
        old_delta_left = parseInt(res[0]);
        old_delta_top = parseInt(res[1]);
      }
    }
    dragRect.left += old_delta_left;
    dragRect.top += old_delta_top;

    // 认为按压后放大的scale即为移动的scale,即moveScale
    if ($draggle.style.transform) {
      $draggle.style.transform = `translate(${old_delta_left}px, ${old_delta_top}px) scale(${this.moveScale})`;
    } else {
      $draggle.style.transform = `scale(${this.moveScale})`;
    }
    // 按下后放大动画
    $draggle.style.transition = "all 0.292s cubic-bezier(.22,.94,0,1)";

    typeof this.onDraggleStart === "function" &&
      this.onDraggleStart($draggle, startPos, {
        translateX: old_delta_left,
        translateY: old_delta_top,
      });
    let inSensorZone = false;
    let dropzone = null;

    // 初始化找到当前最近的放置区
    dropzone = this._initNearestDropZone(
      startPos,
      this.pageScale,
      dragRect,
      dropList,
      this.event
    ).minDropZone;
    if (!dropzone) {
      return;
    }

    // 找到拖拽顶层容器，方便做超出容器退回原位置的处理
    const $wrapper = this.$movingBoundary;
    const wrapperOffset = commonUtil.getOffset($wrapper);
    const bounder = {
      left: wrapperOffset.left,
      top: wrapperOffset.top,
      right: wrapperOffset.left + $wrapper.clientWidth,
      bottom: wrapperOffset.top + $wrapper.clientHeight,
    };

    let prevDropzoneIndex = -1;
    let prevDropzone = null;
    /**
     * touchMove事件监听
     * @param event
     */
    const moveHandler = (event) => {
      $draggle.style.transition = ""; // 开始移动后，删除transition(用于其他css效果能立即生效)
      const eventPos = event.touches ? event.touches[0] : event;
      // 接近边界的时候回去
      if (this._isNearBound(eventPos, bounder)) {
        const mouseUpEvent = new MouseEvent(MOUSE_UP, { bubbles: true });
        $draggle.dispatchEvent(mouseUpEvent);
        return;
      }
      const diff = {
        x: (eventPos.clientX - startPos.clientX) / this.pageScale,
        y: (eventPos.clientY - startPos.clientY) / this.pageScale,
      };
      if (!commonUtil.humanEvent(event)) {
        $draggle.classList.add("replaying");
      }
      const style = $draggle.style;
      style.transform = `translate(${diff.x + old_delta_left}px, ${
        diff.y + old_delta_top
      }px) scale(${this.moveScale})`;
      // console.log(' style.transform', document.getElementById('iii0').style);
      const currentDragRect = Object.assign({}, dragRect);
      currentDragRect.left += diff.x;
      currentDragRect.top += diff.y;

      const dragCenterPos = {
        x: currentDragRect.left + dragRect.width / 2,
        y: currentDragRect.top + dragRect.height / 2,
      };

      const result = this._findNearestDropZone(
        dragCenterPos,
        currentDragRect,
        dropList
      );

      dropzone = result.minDropZone;
      dropList.forEach((item) => {
        item.$content.classList.remove("active");
      });

      if (!dropzone) {
        return;
      }
      // 当离开上一个dropzone时触发 onQuitDropzone 钩子
      if (prevDropzoneIndex !== result.minIndex) {
        this.onQuitDropzone(prevDropzone);
        prevDropzoneIndex = result.minIndex;
        prevDropzone = dropzone;
      }

      // 选项之间不能换顺序
      if (dropzone.$content.classList.contains(this.dragWrapClass)) {
        inSensorZone = false;
        this.onQuitDropzone(dropzone);
        return;
      }

      if (dropzone.minDistance === 0) {
        inSensorZone = true;
      } else {
        // 如果中心点进入拖拽区也认为可放手，防止放置区很大，选项很小的情况
        inSensorZone = commonUtil.pointInRect(
          dragCenterPos,
          dropzone.dropSensorRect
        );
      }

      if (inSensorZone) {
        dropzone.$content.classList.add("active");
        this.onEnterDropzone(dropzone);
      } else {
        this.onQuitDropzone(dropzone);
      }

      /**
       * 注释原因：解决拖拽经过 dropzone 时会出现卡顿的问题
       */
      // 小于15px自动吸过去
      // if (result.minDistance < 15) {
      //   const centerDiff = {
      //     x: dropzone.dropCenterPos.x - dragCenterPos.x,
      //     y: dropzone.dropCenterPos.y - dragCenterPos.y,
      //   };
      //   style.transform = `translate(${
      //     diff.x + centerDiff.x + old_delta_left
      //   }px, ${diff.y + centerDiff.y + old_delta_top}px) scale(${
      //     this.moveScale
      //   })`;
      // }
    };

    /**
     * 结束拖拽，开始执行一系列判断动作：是否可以落下，落下后状态
     */
    const beginCheck = (event) => {
      const _self = this;
      const eventPos = event.changedTouches ? event.changedTouches[0] : event;

      // 手放开的时候如果已经到了感应区域，那么需要判断是否可以落下
      if (inSensorZone && dropzone) {
        // 不允许卡片在自己的dropzone之间来回互换
        if (
          dropzone.$content.classList.contains(this.dragWrapClass) &&
          dropzone.$content.getAttribute(this.domIndex) ===
            $draggle.getAttribute(this.domIndex)
        ) {
          $draggle.style.cssText = original_style;
          $draggle.isDragging = false;
          return;
        }
        const isAllowDrop = this.allowDrop($draggle, dropzone.$content);
        if (isAllowDrop) {
          const dragCenterPos = {
            x: dragRect.left + dragRect.width / 2,
            // 消失效果的用底部对齐
            y:
              dragRect.top +
              (disappearEffect ? dragRect.height : dragRect.height / 2),
          };

          const placeholderReact = this._getDropZonePlaceholderRect(
            dropzone.$content
          );

          /**
           * 如果有指定placeholder就按顺序找到空置的placeholder，将卡片放置到placeholder位置，
           * plcaeholder由.placeholder class标记
           * 如果没有则默认放置在容器中心位置
           */
          let centerDiff;
          let placeholderCenter = {
            x: dropzone.clientX / 2,
            y: dropzone.clientY / 2,
          };
          if (placeholderReact && placeholderReact.dropCenterPos) {
            placeholderCenter = placeholderReact.dropCenterPos;
            centerDiff = {
              x: placeholderCenter.x - dragCenterPos.x,
              y: placeholderCenter.y - dragCenterPos.y,
            };
          } else {
            centerDiff = {
              x: dropzone.dropCenterPos.x - dragCenterPos.x,
              y: dropzone.dropCenterPos.y - dragCenterPos.y,
            };
          }

          this._awaitCaller(this.onDropStart, [
            $draggle,
            this._getNotNullDropZone(dropzone, $draggle),
            { fromX: eventPos.clientX, fromY: eventPos.clientY },
            { toX: placeholderCenter.x, toY: placeholderCenter.y },
          ]).then(() => {
            // 标记该占位符已经被使用
            placeholderReact &&
              placeholderReact.placeholder.classList.add("not-empty");

            // $draggle.style.zIndex = 0;
            $draggle.disabled = true;
            $draggle.isDragging = false;
            $draggle.classList.add("disabled");

            const translatePos = {
              translateX: centerDiff.x + old_delta_left,
              translateY: centerDiff.y + old_delta_top,
            };

            let isCustomDrop = false;
            if (typeof this.setDropingStyle === "function") {
              isCustomDrop = this.setDropingStyle(
                $draggle,
                placeholderReact,
                translatePos
              );
            }

            // 如果不自定义落到placeholder方式，则使用默认的落下方式
            if (!isCustomDrop) {
              if ($draggle.style.transform) {
                $draggle.style.transform = `translate(${
                  centerDiff.x + old_delta_left
                }px, ${centerDiff.y + old_delta_top}px) scale(${
                  this.dropScale
                })`;
              } else {
                $draggle.style.transform = `scale(${this.dropScale})`;
              }
            }
            // $draggle.style.transition =
            //   'all 0.434s cubic-bezier(.22,.94,0,1)';

            if (this.transition) {
              $draggle.addEventListener(
                "transitionend",
                function transitionEnd() {
                  $draggle.removeEventListener("transitionend", transitionEnd);
                  // 执行drop end回调
                  typeof _self.onDropEnd === "function" &&
                    _self.onDropEnd(
                      $draggle,
                      _self._getNotNullDropZone(dropzone, $draggle),
                      { fromX: eventPos.clientX, fromY: eventPos.clientY },
                      { toX: placeholderCenter.x, toY: placeholderCenter.y }
                    );
                }
              );
            } else {
              typeof this.onDropEnd === "function" &&
                this.onDropEnd(
                  $draggle,
                  this._getNotNullDropZone(dropzone, $draggle),
                  { fromX: eventPos.clientX, fromY: eventPos.clientY },
                  { toX: placeholderCenter.x, toY: placeholderCenter.y }
                );
            }
          });
        } else {
          // 错误的话回到原来位置, 如果没到感应区域，也直接回到原位
          this._awaitCaller(this.onRefuseDropStart, [
            $draggle,
            this._getNotNullDropZone(dropzone, $draggle),
            { fromX: eventPos.clientX, fromY: eventPos.clientY },
            { toX: startPos.clientX, toY: startPos.clientY },
          ]).then(() => {
            this._awaitCaller(this.onGoBackStart, [
              $draggle,
              this._getNotNullDropZone(dropzone, $draggle),
              { fromX: eventPos.clientX, fromY: eventPos.clientY },
              { toX: startPos.clientX, toY: startPos.clientY },
            ]).then(() => {
              $draggle.isDragging = false;
              $draggle.style.transition =
                "all 0.434s cubic-bezier(.22,.94,0,1)";
              $draggle.style.transform = `translate(0px, 0px) scale(1.0)`;

              $draggle.addEventListener(
                "transitionend",
                function transitionEnd() {
                  $draggle.removeEventListener("transitionend", transitionEnd);
                  // 执行drop end回调
                  typeof _self.onGoBackEnd === "function" &&
                    _self.onGoBackEnd(
                      $draggle,
                      _self._getNotNullDropZone(dropzone, $draggle),
                      { fromX: eventPos.clientX, fromY: eventPos.clientY },
                      { toX: startPos.clientX, toY: startPos.clientY }
                    );
                }
              );
              if (typeof this.onRefuseDropEnd === "function") {
                new Promise(() => {
                  this.onRefuseDropEnd(
                    $draggle,
                    this._getNotNullDropZone(dropzone, $draggle),
                    { fromX: eventPos.clientX, fromY: eventPos.clientY },
                    { toX: startPos.clientX, toY: startPos.clientY }
                  );
                }).then(() => {
                  // $draggle.parentNode.zIndex = 1;
                });
              }
            });
          });
        }
        // }
      } else {
        // 如果没到感应区域，那么直接回到原位
        this._awaitCaller(this.onGoBackStart, [
          $draggle,
          this._getNotNullDropZone(dropzone, $draggle),
          { fromX: eventPos.clientX, fromY: eventPos.clientY },
          { toX: startPos.clientX, toY: startPos.clientY },
        ]).then(() => {
          $draggle.style.transition = "all 0.434s cubic-bezier(.22,.94,0,1)";
          $draggle.style.transform = `translate(0px, 0px) scale(1.0)`;
          $draggle.isDragging = false;

          $draggle.addEventListener("transitionend", function transitionEnd() {
            $draggle.removeEventListener("transitionend", transitionEnd);
            // 执行drop end回调
            typeof _self.onGoBackEnd === "function" &&
              _self.onGoBackEnd(
                $draggle,
                _self._getNotNullDropZone(dropzone, $draggle),
                { fromX: eventPos.clientX, fromY: eventPos.clientY },
                { toX: startPos.clientX, toY: startPos.clientY }
              );
          });
        });
      }
    };

    /**
     * touchend 事件处理
     */
    const upHandler = (event) => {
      const eventPos = event.changedTouches ? event.changedTouches[0] : event;
      dropList.forEach((item) => {
        item.$content.classList.remove("active");
      });
      document.removeEventListener(MOUSE_MOVE, moveHandler);
      document.removeEventListener(MOUSE_UP, upHandler);
      $draggle.classList.remove("replaying");
      typeof this.onDraggleEnd === "function" &&
        this.onDraggleEnd(
          $draggle,
          startPos,
          { clientX: eventPos.clientX, clientY: eventPos.clientY },
          this._getNotNullDropZone(dropzone, $draggle)
        );
      beginCheck(event);
    };

    /**
     * touchcancel 事件处理
     * 手动触发结束拖拽事件
     */
    const cancelHandler = () => {
      const mouseUpEvent = new Event(MOUSE_UP);
      document.dispatchEvent(mouseUpEvent);
      document.removeEventListener("touchcancel", cancelHandler);
    };

    // 监听touchmove事件
    document.addEventListener(MOUSE_MOVE, moveHandler);
    // 监听touchend事件
    document.addEventListener(MOUSE_UP, upHandler);
    // 监听意外情况导致的 touchcancel 事件
    document.addEventListener("touchcancel", cancelHandler);
  }

  // 同步函数转换器
  async _awaitCaller(fn, params) {
    await (typeof fn === "function" && fn(...params));
  }

  _getNotNullDropZone(dropzone, $draggle) {
    return dropzone ? dropzone.$content : $draggle.closest(".dropzone");
  }

  // 获得drag卡片的dom对象，如果不存在则返回null
  _getDragCardOpt($target) {
    if ($target.classList.contains("drag-wrapper")) {
      return $target;
    } else {
      return $target.closest && $target.closest(".drag-wrapper");
    }
  }

  // 获取指定放置区里的占位元素位置
  _getDropZonePlaceholderRect($dropzone) {
    if (!$dropzone) {
      throw new Error("drop zone is not found!");
    }
    // 找到空的放置点列表
    const placeHolderDomList = Array.from(
      $dropzone.querySelectorAll(".place-holder")
    ).filter((el: any) => {
      return !el.classList.contains("not-empty");
    });

    if (placeHolderDomList && placeHolderDomList.length > 0) {
      // 升序排列
      placeHolderDomList.sort((a: any, b: any) => {
        return a.getAttribute("data-order") - b.getAttribute("data-order");
      });
      const locationInfo = this._getDropZoneRect(placeHolderDomList[0], false);
      return { ...locationInfo, placeholder: placeHolderDomList[0] as any };
    } else {
      return null;
    }
  }

  // 获取每一个放置区的位置及尺寸
  _getDropZoneRect($content, disappearEffect) {
    const width = $content.offsetWidth;
    const height = $content.offsetHeight;
    const { left, top } = commonUtil.getOffsetUntil($content, this.pageClass);
    const dropRect = {
      left,
      // 如果是消失的，需要在盒子的正上方
      top,
      width,
      height,
    };
    // 放置区感应区只有中间的一半
    const dropSensorRect = {
      left,
      // 如果是消失的，需要在盒子的正上方
      top,
      width: width,
      height: height,
    };
    // 放置区中心
    const dropCenterPos = {
      x: dropRect.left + dropRect.width / 2,
      // 消失效果的放置点在盒子的上面
      y:
        dropRect.top +
        (disappearEffect ? dropRect.height * 0.05 : dropRect.height / 2),
    };
    return { dropSensorRect, dropCenterPos, dropRect, $content };
  }

  // 计算拖拽区和放置区中心点距离
  _getCenterDistance(dragCenterPos, currentDragRect, drop) {
    // 是否与整个矩形相交
    // let intersected = commonUtil.intersect(currentDragRect, drop.dropRect);
    // if (!intersected) {
    //   return Number.MAX_VALUE;
    // } else {
    const distance = commonUtil.distance(drop.dropCenterPos, dragCenterPos);
    return distance;
    // }
  }

  // 在mousedown / touchstart 触发时初始化dropzone
  _initNearestDropZone(startPos, pageScale, dragRect, dropList, event) {
    const eventPos = event.touches ? event.touches[0] : event;
    const diff = {
      x: (eventPos.clientX - startPos.clientX) / pageScale,
      y: (eventPos.clientY - startPos.clientY) / pageScale,
    };
    const currentDragRect = Object.assign({}, dragRect);
    currentDragRect.left += diff.x;
    currentDragRect.top += diff.y;

    const dragCenterPos = {
      x: currentDragRect.left + dragRect.width / 2,
      y: currentDragRect.top + dragRect.height / 2,
    };
    const result = this._findNearestDropZone(
      dragCenterPos,
      currentDragRect,
      dropList
    );
    return result;
  }

  // 找到最近的放置区（根据中心点距离）
  _findNearestDropZone(dragCenterPos, currentDragRect, dropList) {
    let minDistance = Number.MAX_VALUE;
    let minDropZone = null;
    let minIndex = -1;
    dropList.forEach((dropzone, index) => {
      const distance = this._getCenterDistance(
        dragCenterPos,
        currentDragRect,
        dropzone
      );
      if (distance < minDistance) {
        minDistance = distance;
        minDropZone = dropzone;
        minIndex = index;
      }
    });
    return { minDistance, minDropZone, minIndex };
  }

  // 判断是否靠近边界
  _isNearBound(pos, bound) {
    const DIFF = 5;
    return (
      Math.abs(bound.left - pos.clientX) < DIFF ||
      Math.abs(bound.top - pos.clientY) < DIFF ||
      Math.abs(bound.right - pos.clientX) < DIFF ||
      Math.abs(bound.bottom - pos.clientY) < DIFF
    );
  }
}

export default Dragger;
