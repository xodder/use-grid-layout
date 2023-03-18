function debounce(fn: (...args: unknown[]) => void, wait?: number) {
  let timerId: number | undefined;

  function debounced(this: any, ...args: unknown[]) {
   clearTimeout(timerId);
   timerId = setTimeout(() => fn.apply(this, args), wait);
  }

  debounced.cancel = function () {
    clearTimeout(timerId);
    timerId = undefined;
  }

  return debounced;
}

export default debounce;
