---
subject: programming-algorithms
section: python-basics
slug: python-variables
title: 'Переменные'
order: 3
updatedAt: '2026-11-27'
published: true
---

Переменная — имя, связанное со значением. С его помощью можно использовать результат позже и присвоить имени новое значение.

```python
price = 120
quantity = 3
total = price * quantity
print(total)  # 360
```

`=` присваивает значение справа имени слева. Значения бывают разных типов: `42` — целое число, `3.5` — дробное, `"Python"` — строка, `True` — логическое значение.

```python
name = "Анна"
name = "Маша"
print(name)  # Маша
```

Имена чувствительны к регистру: `name` и `Name` — разные имена. Используйте понятные названия, например `student_name`. Имя не может начинаться с цифры или содержать пробел.
