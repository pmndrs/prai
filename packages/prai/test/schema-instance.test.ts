import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { buildSchemaInstance } from '../src/schema/instance.js'

describe('schema-instance', () => {
  it('should handle basic object schema instances', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })

    const instance = buildSchemaInstance(
      schema,
      () => 'prefix',
      () => 'suffix',
    )

    expect(typeof instance.name[Symbol.toPrimitive]).toBe('function')
    expect(typeof instance.age[Symbol.toPrimitive]).toBe('function')
    expect(instance.name[Symbol.toPrimitive]()).toContain('prefix')
    expect(instance.name[Symbol.toPrimitive]()).toContain('suffix')
  })

  it('should handle recursive schemas without stack overflow', () => {
    // Define a recursive schema (a category that can have subcategories)
    type Category = {
      name: string
      subcategories: Category[] | null
    }

    // Create a self-referential schema with z.lazy()
    const categorySchema: z.ZodType<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        subcategories: z.array(categorySchema).nullable(),
      }),
    )

    // This should not throw a stack overflow error
    expect(() => {
      const instance = buildSchemaInstance(
        categorySchema,
        () => 'prefix',
        () => 'suffix',
      )

      // Access nested properties to trigger the recursion handling
      const nestedCategory = instance.subcategories[0]
      const deepNestedCategory = nestedCategory.subcategories[0]

      // Verify that we can access the toPrimitive function without error
      expect(typeof nestedCategory.name[Symbol.toPrimitive]).toBe('function')
      expect(typeof deepNestedCategory.name[Symbol.toPrimitive]).toBe('function')
    }).not.toThrow()
  })

  it('should handle mutually recursive schemas without stack overflow', () => {
    // Define types that reference each other
    type Person = {
      name: string
      department: Department
    }

    type Department = {
      title: string
      head: Person
    }

    // Create the mutually recursive schemas with z.lazy()
    const personSchema: z.ZodType<Person> = z.lazy(() =>
      z.object({
        name: z.string(),
        department: departmentSchema,
      }),
    )

    const departmentSchema: z.ZodType<Department> = z.lazy(() =>
      z.object({
        title: z.string(),
        head: personSchema,
      }),
    )

    // This should not throw a stack overflow error
    expect(() => {
      const instance = buildSchemaInstance(
        personSchema,
        () => 'prefix',
        () => 'suffix',
      )

      // Access nested properties to trigger the recursion handling
      const department = instance.department
      const head = department.head
      const headsDepart = head.department

      // Verify that we can access the toPrimitive function without error
      expect(typeof department.title[Symbol.toPrimitive]).toBe('function')
      expect(typeof head.name[Symbol.toPrimitive]).toBe('function')
      expect(typeof headsDepart.title[Symbol.toPrimitive]).toBe('function')
    }).not.toThrow()
  })

  it('should return same instance for recursive references', () => {
    type Category = {
      name: string
      parent: Category | null
    }

    const categorySchema: z.ZodType<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        parent: categorySchema.nullable(),
      }),
    )

    const instance = buildSchemaInstance(categorySchema)

    // When accessing the same schema multiple times, we should get the same instance
    const parent1 = instance.parent
    const parent2 = instance.parent

    // Due to caching, these should reference the same instance
    expect(parent1).toBe(parent2)
  })
})
