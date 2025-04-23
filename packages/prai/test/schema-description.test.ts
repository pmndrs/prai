import { describe, expect, it } from 'vitest'
import { buildSchemaDescription } from '../src/index.js'
import { object, lazy, Schema, string, number, boolean, array, literal, union, optional, record, tuple } from 'zod'

type X = {
  x?: X
}

const x: Schema<X> = object({
  x: lazy(() => x),
})

describe('schema description', () => {
  // Current test for recursive schemas
  it('should describe recursive schemas', () => {
    expect(buildSchemaDescription(x)).to.equal(
      `an object (lets call this type "TypeA") with the field "x" which is a  value of type "TypeA"`,
    )
  })

  // Basic primitive schema types
  it('should describe string schema', () => {
    const schema = string()
    expect(buildSchemaDescription(schema)).to.equal('a string')
  })

  it('should describe number schema', () => {
    const schema = number()
    expect(buildSchemaDescription(schema)).to.equal('a number')
  })

  it('should describe boolean schema', () => {
    const schema = boolean()
    expect(buildSchemaDescription(schema)).to.equal('a boolean')
  })

  // Array schemas
  it('should describe array schema with primitive elements', () => {
    const schema = array(string())
    expect(buildSchemaDescription(schema)).to.equal('a list containing strings')
  })

  it('should describe array schema with object elements', () => {
    const schema = array(object({ name: string(), age: number() }))
    expect(buildSchemaDescription(schema)).to.equal(
      'a list containing objects with the fields "name" which is a string, and "age" which is a number',
    )
  })

  // Object schemas
  it('should describe object schema with multiple fields', () => {
    const schema = object({
      name: string(),
      age: number(),
      isActive: boolean(),
    })
    expect(buildSchemaDescription(schema)).to.equal(
      'an object with the fields "name" which is a string, "age" which is a number, and "isActive" which is a boolean',
    )
  })

  it('should describe object schema with a single field', () => {
    const schema = object({ name: string() })
    expect(buildSchemaDescription(schema)).to.equal('an object with the field "name" which is a string')
  })

  // Optional schemas
  it('should describe optional schema', () => {
    const schema = optional(string())
    expect(buildSchemaDescription(schema)).to.equal('a optional string')
  })

  it('should describe object with optional fields', () => {
    const schema = object({
      name: string(),
      age: optional(number()),
    })
    expect(buildSchemaDescription(schema)).to.equal(
      'an object with the fields "name" which is a string, and "age" which is a optional number',
    )
  })

  // Literal schemas
  it('should describe string literal schema', () => {
    const schema = literal('admin')
    expect(buildSchemaDescription(schema)).to.equal('a literal "admin"')
  })

  it('should describe number literal schema', () => {
    const schema = literal(42)
    expect(buildSchemaDescription(schema)).to.equal('a literal 42')
  })

  it('should describe boolean literal schema', () => {
    const schema = literal(true)
    expect(buildSchemaDescription(schema)).to.equal('a literal true')
  })

  // Union schemas
  it('should describe union of primitive schemas', () => {
    const schema = union([string(), number()])
    expect(buildSchemaDescription(schema)).to.equal('a string, or a number')
  })

  it('should describe union of literals', () => {
    const schema = union([literal('admin'), literal('user'), literal('guest')])
    expect(buildSchemaDescription(schema)).to.equal('a literal "admin", a literal "user", or a literal "guest"')
  })

  // Record schemas
  it('should describe record schema', () => {
    const schema = record(string(), number())
    expect(buildSchemaDescription(schema)).to.equal('a record with keys as strings and values as numbers')
  })

  it('should describe record with complex values', () => {
    const schema = record(
      string(),
      object({
        name: string(),
        age: number(),
      }),
    )
    expect(buildSchemaDescription(schema)).to.equal(
      'a record with keys as strings and values as objects with the fields "name" which is a string, and "age" which is a number',
    )
  })

  // Tuple schemas
  it('should describe tuple schema', () => {
    const schema = tuple([string(), number(), boolean()])
    expect(buildSchemaDescription(schema)).to.equal('a tuple containing a string, a number, and a boolean')
  })

  // Nested objects
  it('should describe nested object schemas', () => {
    const schema = object({
      user: object({
        name: string(),
        contact: object({
          email: string(),
          phone: optional(string()),
        }),
      }),
    })
    expect(buildSchemaDescription(schema)).to.equal(
      'an object with the field "user" which is an object with the fields "name" which is a string, and "contact" which is an object with the fields "email" which is a string, and "phone" which is a optional string',
    )
  })

  // Intersection of objects
  it('should describe intersection of objects', () => {
    const personSchema = object({ name: string(), age: number() })
    const employeeSchema = object({ company: string(), salary: number() })
    const schema = personSchema.and(employeeSchema)

    expect(buildSchemaDescription(schema)).to.equal(
      'an object with the fields "name" which is a string, "age" which is a number, "company" which is a string, and "salary" which is a number',
    )
  })

  // Complex example with multiple features
  it('should describe complex schema with multiple features', () => {
    const addressSchema = object({
      street: string(),
      city: string(),
      zip: string(),
    })

    const userSchema = object({
      id: string(),
      name: string(),
      age: optional(number()),
      addresses: array(addressSchema),
      role: union([literal('admin'), literal('user'), literal('guest')]),
      metadata: record(string(), union([string(), number(), boolean()])),
      preferences: tuple([boolean(), object({ theme: string() })]),
    })

    const result = buildSchemaDescription(userSchema)
    expect(result).to.be.a('string').and.not.to.be.empty
    // This complex schema's exact output may change, so we just check if it contains key elements
    expect(result).to.include('object')
    expect(result).to.include('id')
    expect(result).to.include('name')
    expect(result).to.include('age')
    expect(result).to.include('addresses')
    expect(result).to.include('role')
    expect(result).to.include('metadata')
    expect(result).to.include('preferences')
  })
})
