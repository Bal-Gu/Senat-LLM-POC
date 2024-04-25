import React, {useState, useEffect} from 'react';
import axios from 'axios';
import "./chat.css";
import {useNavigate} from 'react-router-dom';
import NewChatWindow from "../NewChatWindow/NewChatWindow"
import config from '../config/config.json';
import {IoSend} from "react-icons/io5";
import {hourglass} from 'ldrs';
import {flushSync} from "react-dom";


interface Session {
    id: number;
    name: string;
    model: string;
    // include other properties here that a session might have
}

interface Message {
    role: string;
    content: string;
    isDone: boolean;
}

function Chat() {

    const navigate = useNavigate();
    const authToken = localStorage.getItem('authToken');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState("gemma:7b");
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentSession, setCurrentSession] = useState<Session>();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<Number>(-1);
    const [refresh, setRefresh] = useState(false);

    const closeModal = () => {
        setIsModalOpen(false); // Function to close the modal
    };


    useEffect(() => {
        if (!authToken) {
            navigate('/login');
        } else {
            // Fetch sessions and models when the component mounts
            axios.get(`${config.backend_url}/session`, {headers: {Authorization: `Bearer ${authToken}`}})
                .then(response => {
                    const filteredSessions = response.data.list.map((session: any) => ({
                        id: session[0],
                        model: session[2],
                        name: session[3],
                    }));
                    setSessions(filteredSessions);
                })
                .catch(error => console.error(error));

            axios.get(`${config.backend_url}/models`)
                .then(response => {
                    setModels(response.data.models)
                })
                .catch(error => console.error(error));
        }
    }, [authToken, navigate]);

    const handleNewChat = () => {
        setIsModalOpen(true); // Set isModalOpen to true when the button is clicked
    };

    const handleNewSession = (model_name: string, title: string, session_id: number) => {
        // Function to handle the new session
        setMessages([]);
        setSelectedModel(model_name);
        let new_session: Session = {
            id: session_id,
            name: title,
            model: model_name,
        }
        setSessions([new_session].concat(sessions));
        setCurrentSession(new_session);
    };

    const handleSendMessage = () => {
        if (newMessage === "") {
            return;
        }
        let all_messages = messages;
        let current_session = currentSession
        let user_message: Message = {
            role: "user",
            content: newMessage,
            isDone: false
        };
        let assitent_message: Message = {
            role: "assistant",
            content: "Message send",
            isDone: false
        };
        all_messages = all_messages.concat(user_message);
        all_messages = all_messages.concat(assitent_message);
        setMessages(all_messages);
        setNewMessage("");
        // Send a POST request to the /message endpoint
        axios.post(`${config.backend_url}/message`, {
            message: newMessage,
            session: currentSession?.id
        }, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        }).then(async response => {
            let finish_user: boolean = false;
            let finish_assistant: boolean = false;
            let user_index: number = response.data.user_index;
            let assistant_index: number = response.data.assistant_index;
            while (!finish_user || !finish_assistant) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log("Fetch message");
                if (!finish_user) {
                    await axios.get(`${config.backend_url}/singleMessage/${current_session?.id}/${user_index}`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    }).then(response => {
                        user_message.content = response.data.content;
                        if (response.data.isDone) {
                            user_message.isDone = true;
                            finish_user = true;
                        }
                        setMessages(prevMessages => [...all_messages]);

                    }).catch(error => {
                    });
                }
                if (!finish_assistant) {
                    await axios.get(`${config.backend_url}/singleMessage/${current_session?.id}/${assistant_index}`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    }).then(response => {
                        assitent_message.content = response.data.content;
                        console.log(assitent_message);
                        if (response.data.isDone) {
                            assitent_message.isDone = true;
                            finish_assistant = true;
                        }

                        setMessages(prevMessages => [...all_messages]);
                    }).catch(error => {
                    });
                }

            }
        }).catch(error => {
            console.log(error);
        });


    };

    const handleSessionSelection = async (session: Session) => {
        // Set the selected model to the model linked to the session
        setSelectedModel(session.model);
        setCurrentSession(session);
        // Fetch the messages for the selected session
        const response = await axios.get(`${config.backend_url}/history/${session.id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.status === 200) {
            // Set the messages state to the fetched messages
            const mappedMessages = response.data.messages.map(
                (message: any) => {
                    return {
                        role: message["role"],
                        content: message["content"],
                        isDone: message["isDone"]
                    } as Message;
                });
            setMessages(mappedMessages);
        }
    };
    hourglass.register();

    const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value;
        setSelectedModel(newModel);
        if (currentSession !== undefined) {
            currentSession.model = newModel;
        }
        if (currentSession) {
            try {
                await axios.patch(`${config.backend_url}/updateModel/${currentSession.id}`, {
                    model_name: newModel
                }, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
            } catch (error) {
                console.error(error);
            }
        }
    };

    return (
        <div className="MainFrame">
            <div className="SelectionPanel">
                <div className="SectionInSelection">
                    <button className="NewChatButton" onClick={handleNewChat}>New Chat</button>
                </div>
                <div className="ScrolableSessionPannel">
                    {sessions.map(session => (
                        <div className="SessionSelection">
                            <button className= {currentSession === session ? "SessionSelectionButtonCurrent" : "SessionSelectionButton"}
                                    onClick={() => handleSessionSelection(session)}>{session.name}</button>

                        </div>

                    ))}

                </div>

            </div>
            <div className="ChatContainer">
                <div className="ChatFrame">
                    {messages.map((message) => (
                        <div className="ChatLine">
                            {message.role === "assistant" ? (
                                <>
                                    <div className="AssistantChatMessage">
                                        <h3>Assitant</h3>
                                        <p>{message.content}</p>
                                    </div>
                                    <div>
                                        {message.isDone ? <></> : <l-hourglass
                                            size="40"
                                            bg-opacity="0.1"
                                            speed="1.75"
                                            color="purple"
                                        ></l-hourglass>}
                                    </div>
                                    <div className="UserChatMessagePlaceHolder"></div>
                                </>
                            ) : (
                                <>
                                    <div className="AssistantChatMessagePlaceHolder"></div>
                                    <div>
                                        {message.isDone ? <></> : <l-hourglass
                                            size="40"
                                            bg-opacity="0.1"
                                            speed="1.75"
                                            color="purple"
                                        ></l-hourglass>}
                                    </div>
                                    <div className="UserChatMessage">
                                        <h3>User</h3>
                                        <p>{message.content}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                {currentSession !== undefined ?
                    <div className="ChatInput">
                        <select value={selectedModel} onChange={handleModelChange}>
                            {models.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                        <div className="InputButtonWrapper">
                            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}/>
                            <button onClick={handleSendMessage}>
                                <IoSend style={{color: "8000ff"}}/>
                            </button>
                        </div>
                    </div> : <></>
                }
            </div>
            <NewChatWindow models={models} onNewSession={handleNewSession} isOpen={isModalOpen} onClose={closeModal}/>
        </div>

    );
}

export default Chat;