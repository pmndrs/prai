import { array, number, object, string, TypeOf } from 'zod'
import { importJson, leftInnerJoinStep, listStep, mapStep, mock, parseJson, task } from 'prai'
import { redisLogger } from '@prai/redis'
import { RedisClientType } from 'redis'

const schema = array(object({ gender: string(), heightInMeter: number() }))

export type getNamesFoodAndMonthlyCostsInput = TypeOf<typeof schema>

export async function getNamesFoodAndMonthlyCosts(
  taskName: string,
  input: unknown,
  nonSubClient: RedisClientType,
  options?: { abort?: AbortSignal },
) {
  const endpoint = mock({ abortSignal: options?.abort })
  redisLogger(nonSubClient, endpoint)

  const result = await task(
    endpoint,
    () => `find names, food, and monthly costs for my dogs`,
    async (rootTask) => {
      const dogNames = await task(
        rootTask,
        () => `find good names for my dogs.`,
        async (task) => {
          const validatedInput = parseJson(task, input, schema)

          const result = await mapStep(
            task,
            validatedInput,
            object({
              name: string(),
              gender: string(),
              heightInMeter: number(),
            }),
            (dog) => `find a good name based on ${dog}`,
          )

          return result
        },
      )

      const dogsWithFood = await task(
        rootTask,
        () => `find good food for my dogs.`,
        async (task) => {
          const dogFoods = await listStep(
            task,
            () => `available food for dogs`,
            object({ food: string(), pricePerKgInEuro: number() }),
          )

          return await leftInnerJoinStep(task, dogNames, dogFoods, [
            [(dog) => `${dog}`, () => `might like`, (food) => `${food.food}`],
          ])
        },
      )

      return await task(
        rootTask,
        () => `estimate the monthly food cost of each of my dogs.`,
        async (task) => {
          const howMuchTheyEatOnWhatTheyEat = await mapStep(
            task,
            dogsWithFood,
            object({
              name: string(),
              howMuchTheyEachPerMonthInKg: number(),
              pricePerKgInEuro: number(),
            }),
            (dog) =>
              `estimate the monthly cost considering ${dog.food}, ${dog.heightInMeter}, and ${dog.pricePerKgInEuro}`,
          )

          return importJson(
            task,
            howMuchTheyEatOnWhatTheyEat.value.map(({ howMuchTheyEachPerMonthInKg, name, pricePerKgInEuro }) => ({
              name,
              monthlyFoodCostInEuro: pricePerKgInEuro * howMuchTheyEachPerMonthInKg,
            })),
            array(object({ name: string(), monthlyFoodCostInEuro: number() })),
          )
        },
      )
    },
    { name: taskName },
  )

  return result
}
