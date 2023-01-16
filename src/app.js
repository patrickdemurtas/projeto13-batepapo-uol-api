import express, { request } from "express"
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


app.post("/participants", async(request, response) => {
    const data = request.body
    const nomeUsuario = request.body.name

    const usuarioSchema = joi.object({
        name: joi.string().required()
    })

    const validation = usuarioSchema.validate(data)

    if (validation.error){
        return response.status(422).send(validation.error.details)
    }

    try {
        const checarUsuario = await db.collection("participants").findOne({name: nomeUsuario})

        if(checarUsuario){
            return response.sendStatus(409)
        }
    } catch (error) {
        response.sendStatus(500)
    }

    try {
        await db.collection("participants").insertOne({name: nomeUsuario, lastStatus: Date.now() })
        await db.collection("messages").insertOne({from: nomeUsuario, to:"Todos", text:"entra na sala...", type:"status", time: dayjs(Date.now()).format("HH:mm:ss")})
        return response.sendStatus(201)
    } catch (error) {
        response.sendStatus(500)
    }

})

   





























































































app.listen(PORT, () => console.log(`servidor rodando na porta: ${PORT}`))

