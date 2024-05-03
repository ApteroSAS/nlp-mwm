export interface TriggerAnimationAction {
  speed?: number
  /** speed of the animation default to 1**/
  reclick?: 0 | 1 | 2
  /** 0: pause and resume, 1: reset and play again, 2: stop and reset the animation **/
  loop?: boolean
  /** loop the animation infinite amount of time default to false**/
  repeat?: number/** number of time the animation should be repeated default to 1**/
}

export interface MediaOptions {
  distanceModel?: string
  /** "linear", "inverse", "exponential" default to "linear"**/
  rolloffFactor?: number
  refDistance?: number
  maxDistance?: number
  coneInnerAngle?: number
  coneOuterAngle?: number
  coneOuterGain?: number
}

export interface SpawnAttachConfig {
  audio?: MediaOptions
  pin?: boolean
  attribute?: any
}
