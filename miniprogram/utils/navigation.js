const FALLBACK_METRICS = Object.freeze({
  statusBarHeight: 20,
  navBarHeight: 44,
  navHeight: 64,
  menuButtonTop: 24,
  menuButtonHeight: 32
});

function getNavigationMetrics() {
  let windowInfo = {};
  try {
    windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (error) {
    windowInfo = {};
  }

  const statusBarHeight = Number(windowInfo.statusBarHeight) || FALLBACK_METRICS.statusBarHeight;
  let menuButton = null;
  try {
    menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  } catch (error) {
    menuButton = null;
  }

  const menuButtonHeight = Number(menuButton?.height) || FALLBACK_METRICS.menuButtonHeight;
  const menuButtonTop = Number(menuButton?.top) > statusBarHeight
    ? Number(menuButton.top)
    : statusBarHeight + 4;
  const topGap = Math.max(4, menuButtonTop - statusBarHeight);
  const navBarHeight = Math.max(40, menuButtonHeight + topGap * 2);

  return {
    statusBarHeight,
    navBarHeight,
    navHeight: statusBarHeight + navBarHeight,
    menuButtonTop,
    menuButtonHeight
  };
}

function applyNavigationMetrics(page) {
  const navMetrics = getNavigationMetrics();
  page.setData({ navMetrics });
  return navMetrics;
}

module.exports = {
  FALLBACK_METRICS,
  getNavigationMetrics,
  applyNavigationMetrics
};
