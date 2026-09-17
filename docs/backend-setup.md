# ERGOFIT — conexión de usuarios con el tablero administrativo

## Estado actual
La página móvil de usuarios ya está creada en `/user/` y permite registro e ingreso. La versión actual funciona localmente como prototipo: guarda los registros en `localStorage` cuando no existe un backend configurado.

## Para que los registros lleguen al tablero público desde cualquier teléfono
GitHub Pages es un alojamiento estático y no puede recibir ni almacenar de forma segura los registros de los usuarios por sí solo. Para producción se requiere una base de datos/API con autenticación y permisos.

La aplicación ya incluye un adaptador preparado para una API REST mediante `API_CONFIG` en `user/app.js`. Para activarlo se debe suministrar una URL HTTPS de backend y configurar el mismo origen de datos en el tablero administrativo.

## Datos mínimos sugeridos
- id
- nombre completo
- correo electrónico
- empresa/entidad
- área
- fecha de registro
- estado de la cuenta

No se recomienda guardar contraseñas en texto plano. La autenticación de producción debe realizarse mediante un proveedor seguro (por ejemplo, Supabase Auth o Firebase Authentication) y las contraseñas deben ser gestionadas por ese proveedor.

## Flujo objetivo
1. Trabajador abre `https://brandonrolasquez-design.github.io/Ergofit/user/`.
2. Completa el registro desde su smartphone.
3. El frontend envía el registro al backend seguro.
4. La base de datos almacena el usuario.
5. El tablero administrativo consulta los usuarios autorizados y muestra el nuevo registro.
6. Las evaluaciones y pausas activas quedan asociadas al usuario autenticado.

## Importante
No se debe habilitar una base de datos pública sin reglas de seguridad. La URL y las claves de un proyecto real deben configurarse mediante el proveedor elegido; nunca se debe publicar una clave privada o una contraseña administrativa dentro del repositorio.
