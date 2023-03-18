import debounce from './utils/debounce';
import React from 'react';

type GridLayoutItem = {
  [key: string]: unknown;
  width?: number;
  height?: number;
};

export type GridLayoutRect = {
  width: number;
  height: number;
  x: number;
  y: number;
};

export type GridLayoutConfig = {
  items: GridLayoutItem[];
  rowHeight: number;
  gap: number;
  maximumStretchFactor: number;
  maximumShrinkFactor: number;
  defaultAspectRatio: number;
  uniform?: boolean;
};

export type UseGridLayoutResult = {
  rects: GridLayoutRect[];
  containerHeight: number;
};

function useGridLayout<T extends HTMLElement>(
  containerRef: React.RefObject<T>,
  config: GridLayoutConfig
) {
  const containerWidth = useContainerWidth(containerRef);

  const layout = React.useMemo(() => {
    return computeLayout(containerWidth, config);
  }, [containerWidth, config]);

  if (containerRef.current) {
    const heightDiff = Math.abs(
      Number(containerRef.current.style.height?.replace('px', '')) -
        layout.containerHeight
    );

    if (heightDiff > 10) {
      containerRef.current.style.setProperty(
        'height',
        `${layout.containerHeight}px`
      );
    }
  }

  return layout;
}

function useContainerWidth<T extends HTMLElement>(
  containerRef: React.RefObject<T>
) {
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    const updateContainerWidth = debounce(() => {
      const container = containerRef.current;
      if (container && containerWidth !== container.clientWidth) {
        setContainerWidth(container.clientWidth);
      }
    }, 200);

    updateContainerWidth();

    function onTransitionEnd(e: TransitionEvent) {
      if ((e.target as HTMLElement)?.contains(containerRef.current)) {
        updateContainerWidth();
      }
    }

    window.addEventListener('resize', updateContainerWidth);
    window.addEventListener('transitionend', onTransitionEnd);

    return () => {
      updateContainerWidth.cancel();
      window.removeEventListener('resize', updateContainerWidth);
      window.removeEventListener('transitionend', onTransitionEnd);
    };
  });

  return containerWidth;
}

function computeLayout(containerWidth: number, config: GridLayoutConfig) {
  const rects: GridLayoutRect[] = [];
  const maximumShrinkFactor = config.maximumShrinkFactor || 0.2;
  const maximumStretchFactor = config.maximumStretchFactor || 0.5;
  const defaultAspectRatio = config.defaultAspectRatio || 4 / 3;

  let row: GridLayoutRect[] = [];
  let currentItemIndex = 0;
  let currentRowWidth = 0;
  let containerHeight = 0;

  let uniformAspectRatio = 0;
  let uniformRowHeight = 0;

  while (currentItemIndex < config.items.length) {
    const currentItem = config.items[currentItemIndex];
    const itemHasDimension = !!currentItem.width && !!currentItem.height;

    const itemAspectRatio =
      config.uniform && uniformAspectRatio
        ? uniformAspectRatio
        : itemHasDimension
        ? currentItem.width! / currentItem.height!
        : defaultAspectRatio;

    const computedItemHeight =
      config.uniform && uniformRowHeight ? uniformRowHeight : config.rowHeight;
    const computedItemWidth = itemAspectRatio * computedItemHeight;

    const computedItemRect: GridLayoutRect = {
      x: currentRowWidth,
      y: containerHeight,
      width: computedItemWidth,
      height: computedItemHeight,
    };

    if (rowCanTakeItem(computedItemRect)) {
      addItemToRow(computedItemRect);
      if (isLastItem(currentItemIndex)) {
        moveToNextRow();
      }
      currentItemIndex++;
    } else if (isFirstItemInRow()) {
      addItemToRow(computedItemRect);
      moveToNextRow();
      currentItemIndex++;
    } else {
      moveToNextRow();
    }
  }

  function rowCanTakeItem(item: GridLayoutRect) {
    currentRowWidth += item.width + config.gap;
    const canTakeItem = currentRowWidth < containerWidth || rowCanBeShrinked();
    currentRowWidth -= item.width + config.gap;
    return canTakeItem;
  }

  function isFirstItemInRow() {
    return row.length === 0;
  }

  function addItemToRow(item: GridLayoutRect) {
    currentRowWidth += item.width + config.gap;
    row.push(item);
  }

  function moveToNextRow() {
    currentRowWidth -= config.gap;

    const canAdjustRow = !config.uniform || !uniformAspectRatio;

    if (canAdjustRow) {
      if (rowCanBeShrinked() || rowCanBeStretched()) {
        scaleItemsInRowToFitContainerWidth();
      }

      uniformAspectRatio = row[0].width / row[0].height;
      uniformRowHeight = row[0].height;
    }

    rects.push(...row);
    containerHeight += computeRowHeight() + config.gap;
    row = [];
    currentRowWidth = 0;
  }

  function rowCanBeShrinked() {
    return Math.abs(computeScaleFactor()) <= maximumShrinkFactor;
  }

  function rowCanBeStretched() {
    return Math.abs(computeScaleFactor()) <= maximumStretchFactor;
  }

  function scaleItemsInRowToFitContainerWidth() {
    const scaleFactor = computeScaleFactor();
    const rowHeight = computeRowHeight();

    for (let i = 0; i < row.length; i++) {
      row[i].width += scaleFactor * row[i].width;
      row[i].height = rowHeight;
      if (i === 0) continue;
      row[i].x = row[i - 1].x + row[i - 1].width + config.gap;
    }
  }

  function computeScaleFactor() {
    return (containerWidth - currentRowWidth) / currentRowWidth;
  }

  function computeRowHeight() {
    if (config.uniform && uniformRowHeight) {
      return uniformRowHeight;
    }

    if (rowCanBeShrinked() || rowCanBeStretched()) {
      return (config.rowHeight / currentRowWidth) * containerWidth;
    }

    return config.rowHeight;
  }

  function isLastItem(index: number) {
    return index === config.items.length - 1;
  }

  return {
    rects,
    containerHeight,
  };
}

export default useGridLayout;
