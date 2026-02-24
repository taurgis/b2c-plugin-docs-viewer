export function firstFulfilled<T>(promises: Array<Promise<T>>): Promise<T | null> {
  if (promises.length === 0) return Promise.resolve(null);

  return new Promise<T | null>((resolve) => {
    let fulfilled = false;
    let rejectedCount = 0;

    for (const promise of promises) {
      promise
        .then((value) => {
          if (!fulfilled) {
            fulfilled = true;
            resolve(value);
          }
        })
        .catch(() => {
          rejectedCount += 1;
          if (!fulfilled && rejectedCount === promises.length) {
            resolve(null);
          }
        });
    }
  });
}
