import { View, StyleSheet, ActivityIndicator } from 'react-native';

export default function Index() {

    return (
        <View style={styles.container}>
            <ActivityIndicator size={44} color='#1A1A2E'/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 32,
        backgroundColor: '#1A1A2E',
        justifyContent: 'center',
        alignItems: 'center'
    },
});