import express, { request, response } from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
import joi from "joi"

dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db;

try {
    await mongoClient.connect()
    db = mongoClient.db()
} catch (error) {
    console.log('erro no servidor')
}

const app = express()

app.use(express.json())
app.use(cors())

const PORT = 5000


app.post("/participants", async (request, response) => {
    const data = request.body
    const nomeUsuario = request.body.name

    const usuarioSchema = joi.object({
        name: joi.string().required()
    })

    const validation = usuarioSchema.validate(data)

    if (validation.error) {
        return response.status(422).send(validation.error.details)
    }

    try {
        const checarUsuario = await db.collection("participants").findOne({ name: nomeUsuario })

        if (checarUsuario) {
            return response.sendStatus(409)
        }
    } catch (error) {
        response.sendStatus(500)
    }

    try {
        await db.collection("participants").insertOne({ name: nomeUsuario, lastStatus: Date.now() })
        await db.collection("messages").insertOne({ from: nomeUsuario, to: "Todos", text: "entra na sala...", type: "status", time: dayjs(Date.now()).format("HH:mm:ss") })
        return response.sendStatus(201)
    } catch (error) {
        response.sendStatus(500)
    }

})


app.get("/participants", async (request, response) => {

    try {
        const usuarios = await db.collection("participants").find().toArray()
        return response.send(usuarios)
    } catch (error) {
        return response.sendStatus(500)
    }
})

app.post("/messages", async (request, response) => {
    const data = request.body
    const origemUsuario = request.headers.user

    const usuarioSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required()
    })

    const validation = usuarioSchema.validate(data)
    if (validation.error) {
        return response.sendStatus(422)
    }

    try {
        const validarUsuario = await db.collection("participants").findOne({ name: origemUsuario })
        if (!validarUsuario) {
            return response.sendStatus(422)
        }
    } catch (error) {
        response.sendStatus(500)
    }

    try {
        await db.collection("messages").insertOne({ from: origemUsuario, to: data.to, text: data.text, type: data.type, time: dayjs(Date.now()).format("HH:mm:ss") })
        response.sendStatus(201)
    } catch (error) {
        response.sendStatus(500)
    }

})

app.get("/messages", async (request, response) => {
    const { user } = request.headers
    const { query } = request

    try {
        const mensagens = await db.collection("messages").find({ $or: [{ from: user }, { to: user }, { to: "Todos" }] }).toArray()
        if (query.limit) {
            const limite = Number(query.limit)
            if (isNaN(limite) || limite < 1) {
                return response.sendStatus(422)
            } else {
                return response.send([...mensagens].slice(-limite).reverse())
            }

        }
        return response.send([...mensagens].reverse())
    } catch (error) {
        return response.sendStatus(500)
    }
})


app.post("/status", async (request, response) => {
    const { user } = request.headers

    try {
        const validarUsuario = await db.collection("participants").findOne({ name: user })
        if (!validarUsuario) {
            return response.sendStatus(404)
        } else {
            await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
            return response.sendStatus(200)
        }
    } catch (error) {
        return response.sendStatus(500)
    }
})

app.delete("/messages/:id", async (request, response) => {
    const { id } = request.params
    const nome = request.headers.user
    
    const usuario = await db.collection("participants").find({name: nome}).next()
    const mensagemX = await db.collection("messages").find({_id: ObjectId(id)}).next()
    if(!mensagemX){
        return response.sendStatus(404)
    } else if(usuario.name !== mensagemX.from){
        return response.sendStatus(401)
    } 

    await db.collection("messages").deleteOne({_id: mensagemX._id})

    return response.sendStatus(200)


   
})


setInterval(async() => {
    try {
        const usuarios = await db.collection("participants").find().toArray()
        usuarios.forEach(async(u) => {
            if((Date.now() - 10000) > u.lastStatus){
                await db.collection("participants").deleteOne({_id: ObjectId(u._id)})
                await db.collection("messages").insertOne({from: u.name, to: "Todos", text: "sai da sala...", type: "status", time: dayjs(Date.now()).format("HH:mm:ss")})
            }
        })
    } catch (error) {
        return response.sendStatus(500)
    }
}, 15000)

app.listen(PORT, () => console.log(`servidor rodando na porta: ${PORT}`))

