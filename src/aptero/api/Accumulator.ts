let accumulator = ''
let accumulatorLength = -1
export const accumulateOrGetValue = (chunk: string): string => {
  let res = ''
  for (const char of chunk) {
    // if text start with $ => acumulate else just return the char returl '' otherwise
    // format `$${payload.length} ${payload}` <= this message can be chuncked and need to be acumulated and returned only when the last chunck is received and the message is complete
    if (char.startsWith('$')) {
      accumulatorLength = 0 // accumulation started but no length yet
      continue
    }
    if (accumulatorLength !== -1) {
      accumulator += char
      if (accumulatorLength === 0) {
        if (accumulator.endsWith(' ')) {
          try {
            // get the length of the payload
            accumulatorLength = parseInt(accumulator.replace('0', ''))
            accumulator = ''
          } catch (e) {
            /* ignore */
          }
        }
      } else {
        res += char
        if (accumulator.length === accumulatorLength) {
          // end of the message reset the accumulator
          accumulator = ''
          accumulatorLength = -1
        }
      }
    } else {
      res += char
    }
  }
  return res
}
