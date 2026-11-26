---
subject: programming-algorithms
section: python-basics
slug: python-functions
title: 'Функции'
order: 6
updatedAt: '2026-11-27'
published: true
---

Функция объединяет действия под одним именем. Её можно вызывать многократно с разными входными данными.

```python
def total_price(price, quantity):
    return price * quantity

result = total_price(120, 3)
print(result)  # 360
```

`def` создаёт функцию. `price` и `quantity` — параметры; `120` и `3` при вызове — аргументы. `return` возвращает результат и завершает функцию. Без `return` функция возвращает `None`.

`print()` показывает значение на экране, а `return` позволяет сохранить результат и использовать его дальше:

```python
with_delivery = total_price(100, 2) + 50
print(with_delivery)  # 250
```

Переменные, созданные внутри функции, обычно доступны только внутри неё. Отступ показывает, какие команды относятся к функции.
