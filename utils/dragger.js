import commonUtil from "./common-util.js";

/**
 * 拖拽功能实现方法，调用beginDrag触发拖拽功能
 * @param {*} pageClass 模板容器class名称，string类型
 */
function Dragger(pageClass) {
  this.pageClass = pageClass;
}

Dragger.prototype = {
  beginDrag({
    event,
    $pageContainer, // 模板容器，页面dom
    $movingBoundary, // 可移动的边界，dom对象
    dragWrapClass, // 标记可拖拽卡片的class, string变量
    domIndex, // 标记同类型dom的dom attribute name，默认为data-index,例如<div data-index='0'></div>
    pageScale, // 页面 scale 缩放后需要使用 pageScale 换算移动距离
    moveScale,
    dropScale,
    transition,
    allowDrop,
    setDropingStyle,
    onDraggleStart, // drag开始事件回调
    onDraggleEnd, // drag结束事件回调
    onEnterDropzone, // 进入感应区
    onQuitDropzone,
    onDropStart,
    onRefuseDropStart,
    onDropEnd, // 正确且动效结束callback
    onRefuseDropEnd, // 答案错误时的callback
    goBackStart,
    goBackEnd,
  }) {
    const _self = this;
    let $draggle = _self._getDragCardOpt(event.target);
    if (!$draggle || $draggle.disabled || $draggle.isDragging) {
      return;
    }
    $draggle.isDragging = true;
    $draggle.parentNode.style.zIndex = 9999;
    const touch = event.type === "touchstart";

    // 缓存 startPos 以修复 ios9 的 startPos 内部值会不停改变的问题
    let startPos = event.touches ? event.touches[0] : event;
    startPos = {
      clientX: startPos.clientX,
      clientY: startPos.clientY,
    };
    dragWrapClass = dragWrapClass ? dragWrapClass : "category-option-wrapper";
    domIndex = domIndex ? domIndex : "data-index";
    pageScale = pageScale || pageScale === 0 ? pageScale : 1.0;
    moveScale = moveScale || moveScale === 0 ? moveScale : 1.15;
    dropScale = dropScale || dropScale === 0 ? dropScale : 0.45;
    transition =
      transition === null || transition === undefined ? true : transition;

    onQuitDropzone =
      typeof onQuitDropzone === "function" ? onQuitDropzone : () => {};

    if (touch === null || touch === undefined) {
      throw new Error("touch is must be avaliable!");
    }

    const MOUSE_UP = touch ? "touchend" : "mouseup";
    const MOUSE_MOVE = touch ? "touchmove" : "mousemove";

    // 缓存原来的 style，方便回到原处
    let original_style = $draggle.getAttribute("style");
    let disappearEffect = false;
    // 找出所有的放置区，包括选项的以及题干包含的
    let $contents = Array.prototype.slice.call(
      $pageContainer.querySelectorAll(".dropzone")
    );
    if (!$contents.length) {
      throw new Error("没有设置放置区");
    }
    // 计算出所有放置区的位置及其感应区域
    let dropList = [];
    $contents.forEach(($content) => {
      dropList.push(_self._getDropZoneRect($content, disappearEffect));
    });

    let old_delta_left = 0,
      old_delta_top = 0;
    let dragRect = {
      left: $draggle.offsetLeft,
      top: $draggle.offsetTop,
      width: $draggle.clientWidth,
      height: $draggle.clientHeight,
    };
    // 由于被点击时可能已经有 translate 了，需要加上 translate 内的 x y
    if ($draggle.style && $draggle.style.transform) {
      let reg = $draggle.style.transform.match(/translate\((.*?)\)/);
      let res = reg && reg[1].split(" ");
      if (res) {
        old_delta_left = parseInt(res[0]);
        old_delta_top = parseInt(res[1]);
      }
    }
    dragRect.left += old_delta_left;
    dragRect.top += old_delta_top;

    // 认为按压后放大的scale即为移动的scale,即moveScale
    if ($draggle.style.transform) {
      $draggle.style.transform = `translate(${old_delta_left}px, ${old_delta_top}px) scale(${moveScale})`;
    } else {
      $draggle.style.transform = `scale(${moveScale})`;
    }
    // 按下后放大动画
    $draggle.style.transition = "all 0.292s cubic-bezier(.22,.94,0,1)";

    //
    typeof onDraggleStart === "function" &&
      onDraggleStart($draggle, startPos, {
        translateX: old_delta_left,
        translateY: old_delta_top,
      });
    let inSensorZone = false,
      dropzone = null;

    // 初始化找到当前最近的放置区
    dropzone = _self._initNearestDropZone(
      startPos,
      pageScale,
      dragRect,
      dropList,
      event
    ).minDropZone;
    if (!dropzone) {
      return;
    }

    // 找到拖拽顶层容器，方便做超出容器退回原位置的处理
    const $wrapper = $movingBoundary;
    let wrapperOffset = commonUtil.getOffset($wrapper);
    let bounder = {
      left: wrapperOffset.left,
      top: wrapperOffset.top,
      right: wrapperOffset.left + $wrapper.clientWidth,
      bottom: wrapperOffset.top + $wrapper.clientHeight,
    };

    let prevDropzoneIndex = -1,
      prevDropzone = null;
    const moveHandler = (event) => {
      $draggle.style.transition = ""; // 开始移动后，删除transition(用于其他css效果能立即生效)
      let eventPos = event.touches ? event.touches[0] : event;
      // 接近边界的时候回去
      if (_self._isNearBound(eventPos, bounder)) {
        let mouseUpEvent = new MouseEvent(MOUSE_UP, { bubbles: true });
        $draggle.dispatchEvent(mouseUpEvent);
        return;
      }
      let diff = {
        x: (eventPos.clientX - startPos.clientX) / pageScale,
        y: (eventPos.clientY - startPos.clientY) / pageScale,
      };
      if (!commonUtil.humanEvent(event)) {
        $draggle.classList.add("replaying");
      }
      let style = $draggle.style;
      style.transform = `translate(${diff.x + old_delta_left}px, ${
        diff.y + old_delta_top
      }px) scale(${moveScale})`;

      let currentDragRect = Object.assign({}, dragRect);
      currentDragRect.left += diff.x;
      currentDragRect.top += diff.y;

      let dragCenterPos = {
        x: currentDragRect.left + dragRect.width / 2,
        y: currentDragRect.top + dragRect.height / 2,
      };

      let result = _self._findNearestDropZone(
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
        onQuitDropzone(prevDropzone);
        prevDropzoneIndex = result.minIndex;
        prevDropzone = dropzone;
      }

      // 选项之间不能换顺序
      if (dropzone.$content.classList.contains(dragWrapClass)) {
        inSensorZone = false;
        onQuitDropzone(dropzone);
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
        onEnterDropzone(dropzone);
      } else {
        onQuitDropzone(dropzone);
      }

      // 小于15px自动吸过去
      if (result.minDistance < 15) {
        let centerDiff = {
          x: dropzone.dropCenterPos.x - dragCenterPos.x,
          y: dropzone.dropCenterPos.y - dragCenterPos.y,
        };
        style.transform = `translate(${
          diff.x + centerDiff.x + old_delta_left
        }px, ${diff.y + centerDiff.y + old_delta_top}px) scale(${moveScale})`;
      }
    };
    document.body.addEventListener(MOUSE_MOVE, moveHandler); // 监听touchmove事件

    /**
     * 结束拖拽，开始执行一系列判断动作：是否可以落下，落下后状态
     */
    const beginCheck = (event) => {
      let eventPos = event.changedTouches ? event.changedTouches[0] : event;

      // 手放开的时候如果已经到了感应区域，那么需要判断是否可以落下
      if (inSensorZone && dropzone) {
        // 不允许卡片在自己的dropzone之间来回互换
        if (
          dropzone.$content.classList.contains(dragWrapClass) &&
          dropzone.$content.getAttribute(domIndex) ===
            $draggle.getAttribute(domIndex)
        ) {
          $draggle.style.cssText = original_style;
          $draggle.isDragging = false;
          return;
        }

        if (allowDrop($draggle, dropzone.$content)) {
          let dragCenterPos = {
            x: dragRect.left + dragRect.width / 2,
            // 消失效果的用底部对齐
            y:
              dragRect.top +
              (disappearEffect ? dragRect.height : dragRect.height / 2),
          };

          let placeholderReact = _self._getDropZonePlaceholderRect(
            dropzone.$content
          );

          /**
           * 如果有指定placeholder就按顺序找到空置的placeholder，将卡片放置到placeholder位置，
           * plcaeholder由.placeholder class标记
           * 如果没有则默认放置在容器中心位置
           */
          let centerDiff,
            placeholderCenter = {
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

          _self
            ._awaitCaller(onDropStart, [
              $draggle,
              _self._getNotNullDropZone(dropzone, $draggle),
              { fromX: eventPos.clientX, fromY: eventPos.clientY },
              { toX: placeholderCenter.x, toY: placeholderCenter.y },
            ])
            .then(() => {
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
              if (typeof setDropingStyle === "function") {
                isCustomDrop = setDropingStyle(
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
                  }px, ${centerDiff.y + old_delta_top}px) scale(${dropScale})`;
                } else {
                  $draggle.style.transform = `scale(${dropScale})`;
                }
              }
              // $draggle.style.transition =
              //   'all 0.434s cubic-bezier(.22,.94,0,1)';

              if (transition) {
                $draggle.addEventListener(
                  "transitionend",
                  function transitionEnd() {
                    $draggle.removeEventListener(
                      "transitionend",
                      transitionEnd
                    );
                    // 执行drop end回调
                    typeof onDropEnd === "function" &&
                      onDropEnd(
                        $draggle,
                        _self._getNotNullDropZone(dropzone, $draggle),
                        { fromX: eventPos.clientX, fromY: eventPos.clientY },
                        { toX: placeholderCenter.x, toY: placeholderCenter.y }
                      );
                  }
                );
              } else {
                typeof onDropEnd === "function" &&
                  onDropEnd(
                    $draggle,
                    _self._getNotNullDropZone(dropzone, $draggle),
                    { fromX: eventPos.clientX, fromY: eventPos.clientY },
                    { toX: placeholderCenter.x, toY: placeholderCenter.y }
                  );
              }
            });
        } else {
          // 错误的话回到原来位置, 如果没到感应区域，也直接回到原位
          _self
            ._awaitCaller(onRefuseDropStart, [
              $draggle,
              _self._getNotNullDropZone(dropzone, $draggle),
              { fromX: eventPos.clientX, fromY: eventPos.clientY },
              { toX: startPos.clientX, toY: startPos.clientY },
            ])
            .then(() => {
              _self
                ._awaitCaller(goBackStart, [
                  $draggle,
                  _self._getNotNullDropZone(dropzone, $draggle),
                  { fromX: eventPos.clientX, fromY: eventPos.clientY },
                  { toX: startPos.clientX, toY: startPos.clientY },
                ])
                .then(() => {
                  $draggle.isDragging = false;
                  $draggle.style.transition =
                    "all 0.434s cubic-bezier(.22,.94,0,1)";
                  $draggle.style.transform = `translate(0px, 0px) scale(1.0)`;

                  typeof goBackEnd === "function" &&
                    goBackEnd(
                      $draggle,
                      _self._getNotNullDropZone(dropzone, $draggle),
                      { fromX: eventPos.clientX, fromY: eventPos.clientY },
                      { toX: startPos.clientX, toY: startPos.clientY }
                    );
                  if (typeof onRefuseDropEnd === "function") {
                    new Promise(() => {
                      onRefuseDropEnd(
                        $draggle,
                        _self._getNotNullDropZone(dropzone, $draggle),
                        { fromX: eventPos.clientX, fromY: eventPos.clientY },
                        { toX: startPos.clientX, toY: startPos.clientY }
                      );
                    }).then(() => {
                      $draggle.parentNode.style.zIndex = 1;
                    });
                  }
                });
            });
        }
        // }
      } else {
        // 如果没到感应区域，那么直接回到原位
        _self
          ._awaitCaller(goBackStart, [
            $draggle,
            _self._getNotNullDropZone(dropzone, $draggle),
            { fromX: eventPos.clientX, fromY: eventPos.clientY },
            { toX: startPos.clientX, toY: startPos.clientY },
          ])
          .then(() => {
            $draggle.style.transition = "all 0.434s cubic-bezier(.22,.94,0,1)";
            $draggle.style.transform = `translate(0px, 0px) scale(1.0)`;
            $draggle.isDragging = false;

            typeof goBackEnd === "function" &&
              goBackEnd(
                $draggle,
                _self._getNotNullDropZone(dropzone, $draggle),
                { fromX: eventPos.clientX, fromY: eventPos.clientY },
                { toX: startPos.clientX, toY: startPos.clientY }
              );
          });
      }
    };

    // touchend 事件处理
    const upHandler = (event) => {
      let eventPos = event.changedTouches ? event.changedTouches[0] : event;
      dropList.forEach((item) => {
        item.$content.classList.remove("active");
      });
      document.body.removeEventListener(MOUSE_MOVE, moveHandler);
      document.body.removeEventListener(MOUSE_UP, upHandler);
      $draggle.classList.remove("replaying");
      typeof onDraggleEnd === "function" &&
        onDraggleEnd(
          $draggle,
          startPos,
          { clientX: eventPos.clientX, clientY: eventPos.clientY },
          _self._getNotNullDropZone(dropzone, $draggle)
        );
      beginCheck(event);
    };
    // 监听touchend事件
    document.body.addEventListener(MOUSE_UP, upHandler);
  },
  // 同步函数转换器
  async _awaitCaller(fn, params) {
    await (typeof fn === "function" && fn(...params));
  },
  _getNotNullDropZone(dropzone, $draggle) {
    return dropzone ? dropzone.$content : $draggle.closest(".dropzone");
  },

  // 获得drag卡片的dom对象，如果不存在则返回null
  _getDragCardOpt($target) {
    if ($target.classList.contains("drag-wrapper")) {
      return $target;
    } else {
      return $target.closest && $target.closest(".drag-wrapper");
    }
  },

  // 获取指定放置区里的占位元素位置
  _getDropZonePlaceholderRect($dropzone) {
    const _self = this;
    if (!$dropzone) {
      throw new Error("drop zone is not found!");
    }
    // 找到空的放置点列表
    const placeHolderDomList = Array.from(
      $dropzone.querySelectorAll(".plcae-holder")
    ).filter((el) => {
      return !el.classList.contains("not-empty");
    });

    if (placeHolderDomList && placeHolderDomList.length > 0) {
      // 升序排列
      placeHolderDomList.sort((a, b) => {
        return a.getAttribute("data-order") - b.getAttribute("data-order");
      });
      const locationInfo = _self._getDropZoneRect(placeHolderDomList[0], false);
      return { ...locationInfo, placeholder: placeHolderDomList[0] };
    } else {
      return null;
    }
  },

  // 获取每一个放置区的位置及尺寸
  _getDropZoneRect($content, disappearEffect) {
    const _self = this;
    let width = $content.offsetWidth;
    let height = $content.offsetHeight;
    let { left, top } = commonUtil.getOffsetUntil($content, _self.pageClass);
    let dropRect = {
      left,
      // 如果是消失的，需要在盒子的正上方
      top,
      width,
      height,
    };
    // 放置区感应区只有中间的一半
    let dropSensorRect = {
      left,
      // 如果是消失的，需要在盒子的正上方
      top,
      width: width,
      height: height,
    };
    // 放置区中心
    let dropCenterPos = {
      x: dropRect.left + dropRect.width / 2,
      // 消失效果的放置点在盒子的上面
      y:
        dropRect.top +
        (disappearEffect ? dropRect.height * 0.05 : dropRect.height / 2),
    };
    return { dropSensorRect, dropCenterPos, dropRect, $content };
  },
  // 计算拖拽区和放置区中心点距离
  _getCenterDistance(dragCenterPos, currentDragRect, drop) {
    // 是否与整个矩形相交
    let intersected = commonUtil.intersect(currentDragRect, drop.dropRect);
    if (!intersected) {
      return Number.MAX_VALUE;
    } else {
      let distance = commonUtil.distance(drop.dropCenterPos, dragCenterPos);
      return distance;
    }
  },
  // 在mousedown / touchstart 触发时初始化dropzone
  _initNearestDropZone(startPos, pageScale, dragRect, dropList, event) {
    const _self = this;
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
    const result = _self._findNearestDropZone(
      dragCenterPos,
      currentDragRect,
      dropList
    );
    return result;
  },
  // 找到最近的放置区（根据中心点距离）
  _findNearestDropZone(dragCenterPos, currentDragRect, dropList) {
    const _self = this;
    let minDistance = Number.MAX_VALUE;
    let minDropZone = null,
      minIndex = -1;
    dropList.forEach((dropzone, index) => {
      let distance = _self._getCenterDistance(
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
  },
  // 判断是否靠近边界
  _isNearBound(pos, bound) {
    const DIFF = 5;
    return (
      Math.abs(bound.left - pos.clientX) < DIFF ||
      Math.abs(bound.top - pos.clientY) < DIFF ||
      Math.abs(bound.right - pos.clientX) < DIFF ||
      Math.abs(bound.bottom - pos.clientY) < DIFF
    );
  },
};

export default Dragger;
