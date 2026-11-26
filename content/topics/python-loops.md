---
subject: programming-algorithms
section: python-basics
slug: python-loops
title: 'Циклы'
order: 5
updatedAt: '2026-11-27'
published: true
---

Цикл повторяет действия. `for` перебирает элементы последовательности, а `while` работает, пока его условие истинно.

```python
for number in range(1, 4):
    print(number)
# 1, 2, 3 — каждое число с новой строки
```

`range(1, 4)` задаёт числа от 1 включительно до 4 не включительно. Для каждого числа выполняется блок с отступом.

```python
remaining = 3
while remaining > 0:
    print(remaining)
    remaining -= 1
print("Готово")
# 3, 2, 1, Готово — каждое значение с новой строки
```

В цикле `while` важно менять значение, от которого зависит условие, иначе цикл может не завершиться. `break` досрочно завершает цикл, а `continue` переходит к следующему повторению.
