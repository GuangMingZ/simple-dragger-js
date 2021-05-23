/**
 * 空间参数计算函数工具类
 */
const commonUtils = {
  getOffset(el) {
    let _x = 0;
    let _y = 0;
    while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
      _x += el.offsetLeft - el.scrollLeft;
      _y += el.offsetTop - el.scrollTop;
      el = el.offsetParent;
    }
    return { top: _y, left: _x };
  },

  /**
   * 判断是否是用户触发的事件
   * @param {*} event
   */
  humanEvent(event) {
    // iOS 9没有isTrusted
    if (typeof event.isTrusted !== "undefined") {
      return event.isTrusted;
    }
    switch (event.type) {
      case "click":
      case "mousedown":
      case "mouseover":
      case "mouseup":
        // 如果是代码触发的（并且没有设置screenX）那么screeX会是0
        return !!event.screenX;
      case "touchstart":
      case "touchmove":
      case "touchend":
        // 会没有touches这个属性（如果是手动触发touchend的touches.length是0）
        // return !!(event.touches && event.touches.length);
        return event.touches?.length >= 0;
    }
  },

  // 点是否在矩形内
  pointInRect(p, r) {
    return (
      r.left <= p.x &&
      p.x <= r.left + r.width &&
      r.top <= p.y &&
      p.y <= r.top + r.height
    );
  },

  getOffsetUntil(el, targetClass) {
    let _x = 0;
    let _y = 0;
    while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
      _x += el.offsetLeft - el.scrollLeft;
      _y += el.offsetTop - el.scrollTop;
      el = el.offsetParent;
      if (!el) {
        break;
      }
      if (el.classList.contains(targetClass)) break;
    }
    return { top: _y, left: _x };
  },

  /**
   * 计算两点间距离
   * @param {*} p1
   * @param {*} p2
   */
  distance(p1, p2) {
    return Math.sqrt(
      (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y)
    );
  },

  // 判断两个矩形是否相交
  intersect(r1, r2) {
    return !(
      r2.left > r1.left + r1.width ||
      r2.left + r2.width < r1.left ||
      r2.top > r1.top + r1.height ||
      r2.top + r2.height < r1.top
    );
  },

  // 执行一次事件回调
  once($ele, eventName, handler) {
    $ele.addEventListener(eventName, function process() {
      $ele.removeEventListener(eventName, process);
      handler();
    });
  },

  // 是否为左右挨着的元素
  horizonNearElements(element1, element2, diff) {
    let rect1 = element1.getBoundingClientRect();
    let rect2 = element2.getBoundingClientRect();
    return (
      Math.abs(rect1.top - rect2.top) < diff / 2 &&
      (Math.abs(rect1.left + rect1.width - rect2.left) < diff ||
        Math.abs(rect2.left + rect2.width - rect1.left) < diff)
    );
  },
};

export default commonUtils;
