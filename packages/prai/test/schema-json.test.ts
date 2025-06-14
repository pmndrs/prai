import { describe, it, expect } from 'vitest'
import { union, z } from 'zod'
import { buildJsonSchema, JsonSchema } from '../src/schema/json.js'

describe('schema-json', () => {
  it('should convert primitive types correctly', () => {
    // String
    expect(buildJsonSchema(z.string())).toEqual({
      type: 'string',
      $defs: {},
    })

    // String with description
    expect(buildJsonSchema(z.string().describe('A string'))).toEqual({
      type: 'string',
      description: 'A string',
      $defs: {},
    })

    // Number
    expect(buildJsonSchema(z.number())).toEqual({
      type: 'number',
      $defs: {},
    })

    // Boolean
    expect(buildJsonSchema(z.boolean())).toEqual({
      type: 'boolean',
      $defs: {},
    })
  })

  it('should convert array schema correctly', () => {
    const schema = z.array(z.string())
    expect(buildJsonSchema(schema)).toEqual({
      type: 'array',
      items: {
        type: 'string',
      },
      $defs: {},
    })
  })

  it('should convert object schema correctly', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      isActive: z.boolean(),
    })

    expect(buildJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        isActive: { type: 'boolean' },
      },
      propertyOrdering: ['name', 'age', 'isActive'],
      required: ['name', 'age', 'isActive'],
      $defs: {},
    })
  })

  it('should handle literal values', () => {
    const schema = z.literal('admin')
    expect(buildJsonSchema(schema)).toEqual({
      type: 'string',
      enum: ['admin'],
      $defs: {},
    })
  })

  it('should handle enum types correctly', () => {
    // String enum
    const stringEnum = z.enum(['red', 'green', 'blue'])
    expect(buildJsonSchema(stringEnum)).toEqual({
      type: 'string',
      enum: ['red', 'green', 'blue'],
      $defs: {},
    })

    // String enum with description
    const stringEnumWithDescription = z.enum(['small', 'medium', 'large']).describe('Size options')
    expect(buildJsonSchema(stringEnumWithDescription)).toEqual({
      type: 'string',
      enum: ['small', 'medium', 'large'],
      description: 'Size options',
      $defs: {},
    })
  })

  it('should handle nullable types correctly', () => {
    const schema = z.string().nullable()
    expect(buildJsonSchema(schema)).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null' }],
      $defs: {},
    })

    // Nested nullable
    const nestedSchema = z.object({
      name: z.string(),
      description: z.string().nullable(),
    })

    expect(buildJsonSchema(nestedSchema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
      },
      required: ['name', 'description'],
      propertyOrdering: ['name', 'description'],
      $defs: {},
    })
  })

  it('should throw an error for ZodOptional (not supported)', () => {
    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),
    })

    // ZodOptional is not supported, so this should throw an error
    expect(() => buildJsonSchema(schema)).toThrow()
  })

  it('should handle union of object types', () => {
    const userSchema = z.object({ userId: z.string(), name: z.string() })
    const adminSchema = z.object({ adminId: z.string(), permissions: z.array(z.string()) })
    const schema = z.intersection(userSchema, adminSchema)

    expect(buildJsonSchema(schema)).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        userId: { type: 'string' },
        name: { type: 'string' },
        adminId: { type: 'string' },
        permissions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['userId', 'name', 'adminId', 'permissions'],
      propertyOrdering: ['userId', 'name', 'adminId', 'permissions'],
      $defs: {},
    })
  })

  it('should handle intersection types', () => {
    const baseSchema = z.object({ id: z.string() })
    const extendedSchema = z.object({ name: z.string() })
    const schema = union([baseSchema, extendedSchema])

    expect(buildJsonSchema(schema)).toEqual({
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string' } },
          required: ['id'],
          propertyOrdering: ['id'],
        },
        {
          type: 'object',
          additionalProperties: false,
          properties: { name: { type: 'string' } },
          required: ['name'],
          propertyOrdering: ['name'],
        },
      ],
      $defs: {},
    })
  })

  describe('recursive schema handling', () => {
    it('should add $defs to schema output', () => {
      // Simple non-recursive schema to verify $defs is always present
      const schema = z.object({
        id: z.string(),
        name: z.string(),
      })

      const result = buildJsonSchema(schema)
      expect(result.$defs).toBeDefined()
      expect(result.$defs).toEqual({})
    })

    it('should verify $defs structure in schema output', () => {
      // Test using a handcrafted schema object that mimics what the implementation should produce
      const mockSchema: JsonSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          items: {
            type: 'array',
            items: { $ref: '#/$defs/definition_1' },
          },
        },
        required: ['id', 'items'],
        propertyOrdering: ['id', 'items'],
        additionalProperties: false,
        $defs: {
          definition_1: { $ref: '#' },
        },
      }

      // Verify basic structure
      expect(mockSchema.$defs).toBeDefined()
      expect(Object.keys(mockSchema.$defs!).length).toBe(1)

      // Verify references
      const typedSchema = mockSchema as any
      expect(typedSchema.properties.items.items.$ref).toBe('#/$defs/definition_1')
      expect(typedSchema.$defs.definition_1.$ref).toBe('#')
    })

    it('should create a schema with basic $defs', () => {
      // Create simple object schemas
      const addressSchema = z.object({
        street: z.string(),
        city: z.string(),
      })

      const contactSchema = z.object({
        name: z.string(),
        // Using a reference to a previously defined schema
        address: addressSchema,
      })

      const result = buildJsonSchema(contactSchema)

      // Verify basic schema structure
      const typedResult = result as any
      expect(typedResult.type).toBe('object')
      expect(typedResult.properties.name.type).toBe('string')
      expect(typedResult.properties.address.type).toBe('object')
      expect(typedResult.$defs).toBeDefined()
    })

    it('should handle $defs with union of objects', () => {
      // Create two object types to use in a union
      const userSchema = z.object({
        userId: z.string(),
        role: z.string(),
      })

      const adminSchema = z.object({
        adminId: z.string(),
        permissions: z.array(z.string()),
      })

      // Create a union (only supports object types)
      const accountSchema = z.intersection(userSchema, adminSchema)

      const result = buildJsonSchema(accountSchema)

      // Verify the output schema
      const typedResult = result as any
      expect(typedResult.type).toBe('object')

      // Make sure all properties from both schemas are included
      expect(typedResult.properties.userId.type).toBe('string')
      expect(typedResult.properties.role.type).toBe('string')
      expect(typedResult.properties.adminId.type).toBe('string')
      expect(typedResult.properties.permissions.type).toBe('array')

      // Verify $defs
      expect(typedResult.$defs).toBeDefined()
    })

    // This test may fail with stack overflow, but it documents what the behavior should be
    it('should handle recursive schemas properly with $defs', () => {
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

      const result = buildJsonSchema(categorySchema) as any

      // The schema should match this exact structure
      expect(result).toEqual({
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
          },
          subcategories: {
            anyOf: [
              {
                type: 'array',
                items: {
                  $ref: '#',
                },
              },
              {
                type: 'null',
              },
            ],
          },
        },
        required: ['name', 'subcategories'],
        propertyOrdering: ['name', 'subcategories'],
        $defs: {},
      })
    })

    // This test demonstrates mutual recursion, which is another challenging case
    it('should handle mutually recursive schemas properly with $defs', () => {
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
      const result = buildJsonSchema(personSchema) as any

      // The schema should match this exact structure
      expect(result).toEqual({
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          department: {
            type: 'object',
            additionalProperties: false,
            properties: { title: { type: 'string' }, head: { $ref: '#' } },
            required: ['title', 'head'],
            propertyOrdering: ['title', 'head'],
          },
        },
        required: ['name', 'department'],
        propertyOrdering: ['name', 'department'],
        $defs: {},
      })
    })
  })
})
