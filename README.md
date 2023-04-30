
# Osklang - A simple programming language

# Types
## Numbers
Floating point numbers, integers and all basic math operators are available in Osklang:
```
1 + 2 -- 3
7 - 3 -- 4
6 * 4 -- 24
9 / 2 -- 4.5
7 % 2 -- 1
```

## Strings
Strings are created using `'`, `"`, or <code>`</code>:
```
"Hello World!"
'Foo'
`Bar`
-- These are all valid strings
```
Strings can be added together using `+`:
```
'Foo' + 'Bar' -- 'FooBar'
```
Strings can also be multiplied by integers:
```
'Foo' * 5 -- 'FooFooFooFooFoo'
```
## Booleans
Booleans hold either the value of `true` of `false`.

## Nil
`nil` is the only type that can only have `nil` as value. It is also falsy, which means it is coerced to `false` when used in an if statement or a while loop.

## List
A list is a special type that can contain any number of elements of any type. It is created using `[` and `]`:
```
[1, 2, 3]
['Foo', 'Bar']
[1, 'Foo', true]
```

# Variables
Variables are dynamically typed, do not need declaration, and are function scoped.
```
name = 'Bob'
age = 10
isMinor = true
```
Osklang supports incrementation and decrementation for number variables.
```
x = 10 -- 10
x += 2 -- 12
x -= 20 -- -8
```
```
y = 'Hello'
y += ' World!'
-- y is now 'Hello World!'
```
Because variables when assigned return their new value, you can chain variable declarations:
```
x = y = z = 'foo'
print(x, y, z) -- foo foo foo
```

# If statements
The if statement is a series of comparative expression that if evaluated to `true` execute their code block. If none are executed, the else block executes if present.
```
if x == 10 do
  ...
elif x <= 20 do
  ...
else
  ...
end
```

# For loops
The for loop must have a start and target expression, and can have an optional step expression. Here are several examples:
```
for x = 0, 10 do
  print(x)
end
-- Will output: 0 1 2 3 4 5 6 7 8 9
```
```
for x = 0, 10, 2 do
  print(x)
end
-- Will output 0 2 4 6 8
```
The step can also be negative:
```
for x = 10, 0, -1 do
  print(x)
end
-- Will output 10 9 8 7 6 5 4 3 2 1
```

# Functions
In Osklang, there are two types of functions. The first is the single expression functions:
```
add = function(a, b) => a + b
```
They do not require a return statement, as they always return their expression.

The second type is the multiple statement function:
```
canPass = function(age) do
  if age >= 18 do
    return 'You can pass.'
  else
    return 'You are underage.'
  end
end
```
Both are not named, but they return a function value that can be stored in a variable.
That variable can then be called like so:
```
x = add(15, 8)

canBobPass = checkAge(x)
```