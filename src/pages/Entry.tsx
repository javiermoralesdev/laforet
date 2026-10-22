import { useParams } from "@solidjs/router";

function Entry(){
    const params = useParams();
    return (
        <h1>Entry with id {params.id}</h1>
    )
}

export default Entry;