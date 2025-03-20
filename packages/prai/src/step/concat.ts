import { Data, importJson } from '../data.js'
import { Task } from '../task.js'

export function concat<T>(task: Task, d1: Data<Array<T>>, d2: Data<Array<T>>): Data<Array<T>> {
  return importJson(task, [...d1.value, ...d2.value], d1.schema, undefined, {
    descriptionPrompt: () => `Concatenated ${d1} and ${d2} as one flat list.`,
    name: `${d1.name} concatenated with ${d2.name}`,
  })
}
